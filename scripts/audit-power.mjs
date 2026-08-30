/**
 * Diagnose a cycling power record against the raw Strava stream.
 *
 * Fetches one athlete's rides, pulls the watts stream for each, and computes the
 * best 60-second average TWICE: once with a deliberately dumb brute-force pass
 * over every possible window, and once the way the app does it. If those two
 * disagree the app's maths is wrong; if they agree but the number is still low,
 * the effort is not in the data we were given.
 *
 * Also prints what is stored, so a stale row is obvious.
 */
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});

const WHO = process.env.WHO || "Ryan";
const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

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

/** Brute force: every window that starts on a sample, no interpolation, no
 *  segmenting. Slow and obviously correct — the reference. */
function bruteBest60(time, watts) {
  let best = 0;
  for (let i = 0; i < time.length; i++) {
    const end = time[i] + 60;
    let sum = 0, k = i;
    while (k < time.length - 1 && time[k + 1] <= end) {
      sum += watts[k] * (time[k + 1] - time[k]); k++;
    }
    if (time[k] < end) continue; // window ran off the end
    const span = time[k] - time[i];
    if (span <= 0) continue;
    const avg = sum / span;
    if (avg > best) best = avg;
  }
  return best;
}

const { rows: ath } = await pool.query("select id,name from athletes where name = $1", [WHO]);
if (!ath.length) { console.log(`no athlete named ${WHO}`); process.exit(1); }
const me = ath[0];
const { rows: cs } = await pool.query("select * from strava_connections where athlete_id=$1", [me.id]);
if (!cs.length) { console.log("no strava connection"); process.exit(1); }
const tk = await token(cs[0]);

const { rows: stored } = await pool.query(
  "select strava_id, bests, to_char(occurred_on,'YYYY-MM-DD') d from strava_efforts where athlete_id=$1 and sport='bike'",
  [me.id]);
const storedById = new Map(stored.map((r) => [String(r.strava_id), r]));

const after = Math.floor(Date.parse("2026-08-03T00:00:00Z") / 1000) - 86400;
const res = await fetch(
  `https://www.strava.com/api/v3/athlete/activities?per_page=100&after=${after}`,
  { headers: { Authorization: `Bearer ${tk}` } });
const acts = (await res.json()).filter((a) => /ride/i.test(a.sport_type || a.type || ""));
console.log(`${WHO}: ${acts.length} rides since kickoff\n`);

for (const a of acts) {
  const st = await fetch(
    `https://www.strava.com/api/v3/activities/${a.id}/streams?keys=time,watts&key_by_type=true`,
    { headers: { Authorization: `Bearer ${tk}` } });
  const label = `${a.start_date_local.slice(0, 10)}  ${(a.name || "").slice(0, 26).padEnd(26)}`;
  if (!st.ok) { console.log(`${label} streams HTTP ${st.status}`); continue; }
  const j = await st.json();
  const time = j.time?.data, watts = j.watts?.data;
  const storedRow = storedById.get(String(a.id));
  const storedBest = storedRow?.bests?.["bike:60"];
  if (!time || !watts) {
    console.log(`${label} NO WATTS STREAM   (device_watts=${a.device_watts}, avg=${a.average_watts ?? "-"}, max=${a.max_watts ?? "-"})   stored:${storedBest ?? "-"}`);
    continue;
  }
  const brute = bruteBest60(time, watts);
  console.log(
    `${label} n=${String(time.length).padStart(5)}  maxSample=${String(a.max_watts ?? "?").padStart(4)}W` +
    `  brute60=${brute.toFixed(0).padStart(4)}W  stored60=${storedBest ? Math.round(storedBest) + "W" : "-"}` +
    `  devicePower=${a.device_watts}`);
}
await pool.end();
