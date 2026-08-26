/**
 * Backfill `activities.elevation_m` for sessions imported from Strava before we
 * stored ascent. Strava is the only source that knows the climb, so hand-logged
 * rows are left null (unknown) — see `Activity.elevationM`.
 *
 *   npx tsx --conditions=react-server scripts/backfill-elevation.ts          # dry run
 *   npx tsx --conditions=react-server scripts/backfill-elevation.ts --apply
 *
 * Needs DATABASE_PUBLIC_URL, STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in env.
 * `--conditions=react-server` is required because lib/strava.ts imports
 * `server-only`, which throws under a plain tsx run.
 *
 * Matching: our rows carry no strava_id, so a row is paired with a Strava
 * activity on (athlete, sport, km) — km is derived from Strava's metres to three
 * decimals, so it is effectively a fingerprint — and the nearest date is used to
 * break a tie. Anything still ambiguous is reported and skipped, never guessed.
 */
import pg from "pg";
import { sportOf, type StravaActivity } from "../lib/strava";
import { SPORT_UNIT, type Sport } from "../lib/types";

const APPLY = process.argv.includes("--apply");
const arg = (k: string, d: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const SINCE = arg("since", "2026-08-01");
const KM_TOL = 0.0005;   // km is stored to 3dp, so this is an exact-match window
const DAY_TOL = 2;       // reset-hour shifts can move a row a day off the Strava date

const conn = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
if (!conn || !CLIENT_ID || !CLIENT_SECRET) {
  console.error("Need DATABASE_PUBLIC_URL, STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
const daysApart = (a: string, b: string) =>
  Math.abs((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86_400_000);

interface ConnRow {
  athlete_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string | number;
  name: string;
}
interface OurRow {
  id: string;
  sport: Sport;
  km: number;
  occurred_on: string;
  note: string | null;
}

/** A usable access token, refreshing and PERSISTING first if it has expired.
 *  Strava invalidates the old refresh token on use, so failing to write the new
 *  one back would lock the app out of that athlete's account. */
async function accessTokenFor(row: ConnRow): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (Number(row.expires_at) - 60 > now) return row.access_token;
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      grant_type: "refresh_token", refresh_token: row.refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`token refresh failed (${res.status})`);
  const t = (await res.json()) as {
    access_token: string; refresh_token: string; expires_at: number;
  };
  await pool.query(
    `UPDATE strava_connections SET access_token = $2, refresh_token = $3, expires_at = $4
      WHERE athlete_id = $1`,
    [row.athlete_id, t.access_token, t.refresh_token, t.expires_at],
  );
  console.log(`      refreshed + stored a new token`);
  return t.access_token;
}

async function fetchAll(token: string, afterEpoch: number): Promise<StravaActivity[]> {
  const out: StravaActivity[] = [];
  for (let page = 1; page <= 20; page++) {
    const p = new URLSearchParams({ after: String(afterEpoch), per_page: "100", page: String(page) });
    const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?${p}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`list activities failed (${res.status})`);
    const batch = (await res.json()) as StravaActivity[];
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

(async () => {
  // Same statement db.ts runs at init, so the script works before a deploy.
  await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS elevation_m NUMERIC(10,1)`);

  const { rows: conns } = await pool.query(
    `select c.athlete_id, c.access_token, c.refresh_token, c.expires_at, a.name
       from strava_connections c join athletes a on a.id = c.athlete_id order by a.name`);
  const afterEpoch = Math.floor(Date.parse(SINCE + "T00:00:00Z") / 1000);

  let updated = 0, matched = 0;
  const unmatched: string[] = [], ambiguous: string[] = [];

  for (const c of conns as ConnRow[]) {
    console.log(`\n${c.name}:`);
    const { rows: mine } = await pool.query(
      `select id, sport, km::float8 as km, to_char(occurred_on,'YYYY-MM-DD') as occurred_on, note
         from activities
        where athlete_id = $1 and source = 'strava' and elevation_m is null
          and occurred_on >= $2 order by occurred_on`, [c.athlete_id, SINCE]);
    const needing = (mine as OurRow[]).filter((r) => SPORT_UNIT[r.sport] === "km");
    if (!needing.length) { console.log("   nothing needs backfilling"); continue; }

    let acts: StravaActivity[];
    try {
      acts = await fetchAll(await accessTokenFor(c), afterEpoch);
    } catch (e) { console.log(`   SKIPPED — ${(e as Error).message}`); continue; }

    // Only activities that map to a scored discipline and carry an ascent figure.
    const cands = acts.flatMap((a) => {
      const sport = sportOf(a);
      if (!sport || SPORT_UNIT[sport] !== "km") return [];
      if (typeof a.total_elevation_gain !== "number") return [];
      return [{
        sport,
        km: Math.round(((a.distance ?? 0) / 1000) * 1000) / 1000,
        day: (a.start_date_local || "").slice(0, 10),
        elevationM: Math.max(0, Math.round(a.total_elevation_gain * 10) / 10),
      }];
    });

    for (const row of needing) {
      let hits = cands.filter((x) => x.sport === row.sport && Math.abs(x.km - row.km) <= KM_TOL);
      if (hits.length > 1) {
        const near = hits.filter((x) => daysApart(x.day, row.occurred_on) <= DAY_TOL);
        const best = Math.min(...near.map((x) => daysApart(x.day, row.occurred_on)));
        hits = near.filter((x) => daysApart(x.day, row.occurred_on) === best);
        // Same distance, same day, different climb — no honest way to choose.
        if (hits.length > 1 && new Set(hits.map((h) => h.elevationM)).size > 1) {
          ambiguous.push(`${c.name} ${row.occurred_on} ${row.km}km ${row.sport} (${hits.length} candidates)`);
          continue;
        }
      }
      if (!hits.length) {
        unmatched.push(`${c.name} ${row.occurred_on} ${row.km}km ${row.sport} — ${row.note ?? ""}`);
        continue;
      }
      matched++;
      const m = hits[0];
      console.log(`   ${row.occurred_on}  ${String(row.km).padStart(7)}km ${row.sport.padEnd(5)} -> ${m.elevationM} m`);
      if (APPLY) {
        await pool.query(`UPDATE activities SET elevation_m = $2, updated_at = now() WHERE id = $1`,
          [row.id, m.elevationM]);
        updated++;
      }
    }
  }

  console.log(`\nmatched ${matched}${APPLY ? `, updated ${updated}` : " (dry run — nothing written)"}`);
  if (ambiguous.length) { console.log(`\nambiguous, skipped (${ambiguous.length}):`); for (const u of ambiguous) console.log("   " + u); }
  if (unmatched.length) {
    console.log(`\nno Strava match, left null (${unmatched.length}):`);
    for (const u of unmatched) console.log("   " + u);
  }
  await pool.end();
})().catch(async (e: unknown) => { console.error(e); await pool.end(); process.exitCode = 1; });
