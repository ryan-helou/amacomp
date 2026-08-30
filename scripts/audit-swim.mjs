/**
 * Diagnose the swim record book against the raw Strava streams.
 *
 * Swimming is the one sport with no external check: Strava publishes best
 * efforts for runs and nothing for swims, so the only way to know whether these
 * numbers are real is to look at what the stream actually contains and compute
 * the answer a second, obviously-correct way.
 *
 * The specific worry is pool swims. Their distance stream tends to step a whole
 * length at a time rather than flowing, and a 25 m step landing in one second
 * reads as 25 m/s — far past the 3 m/s ceiling the jump guard uses to throw out
 * GPS teleports. If that is happening, the guard is silently eating real swims.
 */
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const SWIM_CEILING = 3; // m/s, what lib/efforts.ts uses

async function token(conn) {
  const now = Math.floor(Date.now() / 1000);
  if (Number(conn.expires_at) > now + 120) return conn.access_token;
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: conn.refresh_token, grant_type: "refresh_token" }),
  });
  if (!res.ok) throw new Error(`refresh ${res.status}`);
  const j = await res.json();
  await pool.query(
    "update strava_connections set access_token=$2, refresh_token=$3, expires_at=$4 where athlete_id=$1",
    [conn.athlete_id, j.access_token, j.refresh_token, j.expires_at]);
  return j.access_token;
}

/** Brute force, no guard, no interpolation: the reference answer. */
function bruteBest(time, distance, target) {
  let best = null;
  for (let i = 0; i < time.length; i++) {
    for (let j = i + 1; j < time.length; j++) {
      if (distance[j] - distance[i] < target) continue;
      const t = time[j] - time[i];
      if (t > 0 && (best === null || t < best)) best = t;
      break;
    }
  }
  return best;
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

const { rows: ath } = await pool.query("select id,name from athletes");
const names = new Map(ath.map((a) => [a.id, a.name]));
const { rows: conns } = await pool.query("select * from strava_connections");
const { rows: stored } = await pool.query(
  "select strava_id, athlete_id, bests, to_char(occurred_on,'YYYY-MM-DD') d from strava_efforts where sport='swim'");
const storedById = new Map(stored.map((r) => [String(r.strava_id), r]));
console.log(`stored swim rows: ${stored.length}, with bests: ${stored.filter(r=>Object.keys(r.bests||{}).length).length}\n`);

const after = Math.floor(Date.parse("2026-08-03T00:00:00Z") / 1000) - 86400;
for (const conn of conns) {
  const tk = await token(conn);
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=100&after=${after}`,
    { headers: { Authorization: `Bearer ${tk}` } });
  const acts = (await res.json()).filter((a) => /swim/i.test(a.sport_type || a.type || ""));
  if (!acts.length) continue;
  for (const a of acts) {
    const st = await fetch(
      `https://www.strava.com/api/v3/activities/${a.id}/streams?keys=time,distance&key_by_type=true`,
      { headers: { Authorization: `Bearer ${tk}` } });
    const who = (names.get(conn.athlete_id) || "?").padEnd(9);
    const head = `${who} ${a.start_date_local.slice(0,10)} ${(a.name||"").slice(0,20).padEnd(20)} ${(a.distance/1000).toFixed(2)}km`;
    if (!st.ok) { console.log(`${head}  streams HTTP ${st.status}`); continue; }
    const j = await st.json();
    const time = j.time?.data, distance = j.distance?.data;
    const row = storedById.get(String(a.id));
    if (!time || !distance) {
      console.log(`${head}  NO DISTANCE STREAM   stored:${row ? Object.keys(row.bests||{}).length : "no row"}`);
      continue;
    }
    // How badly does it step? Count sample steps that break the swim ceiling.
    let jumps = 0, maxStep = 0, maxSpeed = 0;
    for (let k = 1; k < time.length; k++) {
      const dd = distance[k] - distance[k-1], dt = time[k] - time[k-1];
      if (dd > maxStep) maxStep = dd;
      if (dd > 0 && dt > 0) { const sp = dd/dt; if (sp > maxSpeed) maxSpeed = sp; if (sp > SWIM_CEILING) jumps++; }
      if (dd > 0 && dt <= 0) jumps++;
    }
    const brute = bruteBest(time, distance, 100);
    const mine = row?.bests?.["swim:100"];
    console.log(
      `${head}  n=${String(time.length).padStart(4)} maxStep=${maxStep.toFixed(0).padStart(3)}m ` +
      `maxSpeed=${maxSpeed.toFixed(1).padStart(5)}m/s overCeiling=${String(jumps).padStart(4)}  ` +
      `brute100=${brute!==null?fmt(brute):"   -  "}  ours100=${mine!==undefined?fmt(mine):"   -  "}`);
  }
}
await pool.end();
