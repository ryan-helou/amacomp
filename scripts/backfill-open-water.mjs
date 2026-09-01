/**
 * Classify swims already logged as open water or pool.
 *
 * Strava-sourced swims are matched back to their Strava activity and read for a
 * GPS fix (see `isOpenWater` in lib/strava.ts). `activities` has no `strava_id`
 * and the import ledger carries no activity id, so the match is on
 * (athlete, day, kilometres) — km comes from Strava's metres to three decimals,
 * which makes it a strong fingerprint. This is the same approach the elevation
 * backfill used.
 *
 * REFUSES TO GUESS. A row that matches no Strava activity, or more than one, is
 * left as unknown and reported rather than assigned. Unknown scores as a pool,
 * which is the lower rate, so nothing here can inflate anyone's total.
 *
 * Hand-logged swims cannot be classified at all — there is no data behind them.
 * They stay unknown until their owner edits them with the new toggle.
 *
 * Pass --write to apply; runs as a dry run otherwise.
 */
import pg from "pg";

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

const { rows: ath } = await pool.query("select id, name from athletes");
const names = new Map(ath.map((a) => [a.id, a.name]));
const { rows: conns } = await pool.query("select * from strava_connections");
const { rows: swims } = await pool.query(
  `select id, athlete_id, to_char(occurred_on,'YYYY-MM-DD') d, km::float8 km, source, note, open_water
     from activities where sport='swim' order by occurred_on`);

console.log(`${swims.length} swims logged${WRITE ? "" : "   (DRY RUN — pass --write to apply)"}\n`);

// Every Strava swim we can see, by athlete.
const stravaByAthlete = new Map();
const after = Math.floor(Date.parse("2020-01-01T00:00:00Z") / 1000);
for (const c of conns) {
  try {
    const t = await token(c);
    const r = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=200&after=${after}`,
      { headers: { Authorization: `Bearer ${t}` } });
    const list = (await r.json()).filter((a) => /swim/i.test(a.sport_type || a.type || ""));
    stravaByAthlete.set(c.athlete_id, list);
  } catch (e) {
    console.log(`  ! ${names.get(c.athlete_id)}: ${e.message}`);
  }
}

let open = 0, poolCount = 0, skipped = 0;
for (const s of swims) {
  const who = (names.get(s.athlete_id) || "?").padEnd(9);
  const head = `${who} ${s.d} ${s.km.toFixed(3)}km ${s.source.padEnd(6)}`;

  if (s.source !== "strava") {
    console.log(`${head} UNKNOWN — hand-logged, no data to read`);
    skipped++; continue;
  }
  const candidates = (stravaByAthlete.get(s.athlete_id) || []).filter((a) => {
    const day = (a.start_date_local || "").slice(0, 10);
    const km = Math.round(((a.distance ?? 0) / 1000) * 1000) / 1000;
    return day === s.d && Math.abs(km - s.km) < 0.0015;
  });
  if (candidates.length !== 1) {
    console.log(`${head} UNKNOWN — ${candidates.length} Strava matches, refusing to guess`);
    skipped++; continue;
  }
  const a = candidates[0];
  const ll = a.start_latlng;
  const isOpen = Array.isArray(ll) && ll.length === 2 && Number.isFinite(ll[0]);
  if (isOpen) open++; else poolCount++;
  console.log(
    `${head} ${isOpen ? "OPEN WATER" : "POOL      "}  "${(a.name || "").slice(0, 26)}"` +
    `${isOpen ? `  @ ${ll[0].toFixed(3)},${ll[1].toFixed(3)}` : ""}`);
  if (WRITE) {
    await pool.query("update activities set open_water = $2 where id = $1", [s.id, isOpen]);
  }
}

console.log(`\nopen water: ${open}   pool: ${poolCount}   left unknown: ${skipped}`);
console.log(WRITE ? "written." : "dry run — nothing changed.");
await pool.end();
