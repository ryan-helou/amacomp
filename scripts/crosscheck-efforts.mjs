/**
 * Cross-check our computed run bests against STRAVA'S OWN best efforts.
 *
 * Strava computes best efforts server-side for runs over its own standard
 * distances. Where our ladder overlaps theirs we should agree closely; a large
 * disagreement means our stream maths is wrong, and that is a thing worth
 * knowing before telling anyone the record book is right.
 *
 * Read-only against our database. It does refresh Strava tokens when they have
 * expired, and WRITES THE NEW PAIR BACK — Strava rotates refresh tokens, and
 * refreshing without persisting locks the app out of that athlete's account.
 */
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

/** Strava's own best-effort names → the metres our ladder stores them under. */
const STRAVA_TO_TARGET = {
  "400m": 400,
  "1/2 mile": 804.67,
  "1k": 1000,
  "1 mile": 1609.34,
  "2 mile": 3218.69,
  "5k": 5000,
  "10k": 10000,
  "15k": 15000,
  "20k": 20000,
  "Half-Marathon": 21097.5,
  "30k": 30000,
  Marathon: 42195,
};

async function accessTokenFor(conn) {
  const now = Math.floor(Date.now() / 1000);
  if (Number(conn.expires_at) > now + 120) return conn.access_token;
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`refresh failed ${res.status}`);
  const j = await res.json();
  // Strava rotates the refresh token. Persist or we lock ourselves out.
  await pool.query(
    "update strava_connections set access_token=$2, refresh_token=$3, expires_at=$4 where athlete_id=$1",
    [conn.athlete_id, j.access_token, j.refresh_token, j.expires_at],
  );
  return j.access_token;
}

const fmt = (s) => {
  const w = Math.round(s);
  const h = Math.floor(w / 3600), m = Math.floor((w % 3600) / 60), x = w % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`
           : `${m}:${String(x).padStart(2, "0")}`;
};

const { rows: athletes } = await pool.query("select id, name from athletes");
const names = new Map(athletes.map((a) => [a.id, a.name]));
const { rows: conns } = await pool.query("select * from strava_connections");
const byAthlete = new Map(conns.map((c) => [c.athlete_id, c]));

// The longest runs are where a disagreement matters most, so check those.
const { rows: efforts } = await pool.query(
  `select strava_id, athlete_id, to_char(occurred_on,'YYYY-MM-DD') d, bests
     from strava_efforts where sport='run' and bests ? 'run:10000' order by occurred_on desc limit 6`,
);

let compared = 0, worst = 0, mismatches = 0;
for (const e of efforts) {
  const conn = byAthlete.get(e.athlete_id);
  if (!conn) continue;
  const token = await accessTokenFor(conn);
  const res = await fetch(`https://www.strava.com/api/v3/activities/${e.strava_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { console.log(`  ${e.strava_id}: HTTP ${res.status}`); continue; }
  const act = await res.json();
  const theirs = act.best_efforts || [];
  console.log(`\n${names.get(e.athlete_id)}  ${e.d}  "${act.name}"  ${(act.distance/1000).toFixed(2)} km`);
  if (!theirs.length) { console.log("  (Strava reports no best efforts for this one)"); continue; }
  for (const be of theirs) {
    const target = STRAVA_TO_TARGET[be.name];
    if (!target) continue;
    const mine = e.bests[`run:${target}`];
    if (mine === undefined) {
      console.log(`  ${be.name.padEnd(14)} strava ${fmt(be.elapsed_time).padStart(8)}   ours: MISSING`);
      mismatches++;
      continue;
    }
    const diff = mine - be.elapsed_time;
    const pct = Math.abs(diff) / be.elapsed_time * 100;
    compared++;
    worst = Math.max(worst, pct);
    if (pct > 2) mismatches++;
    console.log(
      `  ${be.name.padEnd(14)} strava ${fmt(be.elapsed_time).padStart(8)}   ours ${fmt(mine).padStart(8)}` +
      `   ${diff >= 0 ? "+" : ""}${diff.toFixed(1)}s  ${pct.toFixed(2)}%${pct > 2 ? "   <-- CHECK" : ""}`,
    );
  }
}
console.log(`\ncompared ${compared} overlapping efforts; worst disagreement ${worst.toFixed(2)}%; flagged ${mismatches}`);
await pool.end();
