/**
 * Mark the Strava runs already logged since the treadmill rate began (2 Nov
 * 2026, TREADMILL in lib/scoring) as treadmill or outside.
 *
 * Same matching as backfill-open-water.mjs — (athlete, day, km), because
 * `activities` carries no Strava id — and the same rule as `isTreadmill` in
 * lib/strava.ts: a VirtualRun or an indoor-flagged run is a treadmill run; a
 * recorded run with no map was indoors; a run typed into Strava by hand stays
 * unknown. REFUSES TO GUESS on an ambiguous match and leaves it unknown, which
 * scores as outside, the lower rate.
 *
 * Pass --write to apply; runs as a dry run otherwise.
 */
import pg from "pg";

const FROM = "2026-11-02";
const WRITE = process.argv.includes("--write");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});
const CID = process.env.STRAVA_CLIENT_ID, CS = process.env.STRAVA_CLIENT_SECRET;

async function token(c) {
  const now = Math.floor(Date.now() / 1000);
  if (Number(c.expires_at) > now + 120) return c.access_token;
  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CID, client_secret: CS,
      refresh_token: c.refresh_token, grant_type: "refresh_token" }),
  });
  if (!r.ok) throw new Error(`refresh ${r.status}`);
  const j = await r.json();
  // Strava rotates refresh tokens; not persisting locks us out of the account.
  await pool.query(
    "update strava_connections set access_token=$2, refresh_token=$3, expires_at=$4 where athlete_id=$1",
    [c.athlete_id, j.access_token, j.refresh_token, j.expires_at]);
  return j.access_token;
}

function treadmill(a) {
  if ((a.sport_type || a.type || "").toLowerCase() === "virtualrun" || a.trainer === true) return true;
  if (a.manual === true) return null;
  const ll = a.start_latlng;
  const hasFix = Array.isArray(ll) && ll.length === 2 && Number.isFinite(ll[0]) && Number.isFinite(ll[1]);
  return hasFix || !!a.map?.summary_polyline ? false : true;
}

const { rows: ath } = await pool.query("select id, name from athletes");
const names = new Map(ath.map((a) => [a.id, a.name]));
const { rows: conns } = await pool.query("select * from strava_connections");
const { rows: runs } = await pool.query(
  `select id, athlete_id, to_char(occurred_on,'YYYY-MM-DD') d, km::float8 km, source, treadmill
     from activities where sport='run' and occurred_on >= $1 order by occurred_on`, [FROM]);

console.log(`${runs.length} runs since ${FROM}${WRITE ? "" : "   (DRY RUN — pass --write to apply)"}\n`);

const after = Math.floor(Date.parse(`${FROM}T00:00:00Z`) / 1000) - 2 * 86400;
const stravaByAthlete = new Map();
for (const c of conns) {
  try {
    const t = await token(c);
    const r = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=200&after=${after}`,
      { headers: { Authorization: `Bearer ${t}` } });
    const list = (await r.json()).filter((a) => /run/i.test(a.sport_type || a.type || ""));
    stravaByAthlete.set(c.athlete_id, list);
  } catch (e) {
    console.log(`  ! ${names.get(c.athlete_id)}: ${e.message}`);
  }
}

let tm = 0, out = 0, unknown = 0;
for (const s of runs) {
  const head = `${(names.get(s.athlete_id) || "?").padEnd(9)} ${s.d} ${s.km.toFixed(3)}km ${s.source.padEnd(6)}`;
  if (s.source !== "strava") { console.log(`${head} UNKNOWN — hand-logged`); unknown++; continue; }
  const sameDay = (stravaByAthlete.get(s.athlete_id) || []).filter(
    (a) => (a.start_date_local || "").slice(0, 10) === s.d);
  const byKm = sameDay.filter((a) => Math.abs(Math.round((a.distance ?? 0)) / 1000 - s.km) < 0.0015);
  const candidates = byKm.length === 1 ? byKm : sameDay.length === 1 ? sameDay : [];
  if (candidates.length !== 1) {
    console.log(`${head} UNKNOWN — ${candidates.length} Strava matches, refusing to guess`);
    unknown++; continue;
  }
  const a = candidates[0];
  const v = treadmill(a);
  if (v === true) tm++; else if (v === false) out++; else unknown++;
  console.log(`${head} ${v === true ? "TREADMILL" : v === false ? "OUTSIDE  " : "UNKNOWN  "}  "${(a.name || "").slice(0, 30)}"`);
  if (WRITE) await pool.query("update activities set treadmill = $2 where id = $1", [s.id, v]);
}

console.log(`\ntreadmill: ${tm}   outside: ${out}   unknown: ${unknown}`);
console.log(WRITE ? "written." : "dry run — nothing changed.");
await pool.end();
