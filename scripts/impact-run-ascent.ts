/**
 * What making running ascent count as distance does to weeks already scored.
 *
 * The rule is retroactive by instruction, so it rewrites finished weeks — the
 * one thing the dated-rate system normally exists to prevent. That is fine as a
 * decision and reckless as a surprise, so this measures it: every athlete-week,
 * before and after, and specifically any week that crosses the quota line in
 * either direction.
 *
 * Uses the app's own scoring, with the rule turned off for "before", so the
 * comparison cannot drift from what the app actually does.
 */
import pg from "pg";
import { standingsForRange } from "../lib/scoring";
import { weekStart, weekEnd } from "../lib/dates";
import type { Activity, Athlete, Settings } from "../lib/types";
import { DEFAULT_SETTINGS } from "../lib/types";

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_PUBLIC_URL,
    ssl: { rejectUnauthorized: false },
  });

  const { rows: aRows } = await pool.query("select id, name from athletes order by name");
  const athletes: Athlete[] = aRows.map((r) => ({
    id: r.id, name: r.name, weightKg: null,
    avatarColor: null, avatarGlyph: null, avatarUrl: null,
  }));

  const { rows: actRows } = await pool.query(
    `select id, athlete_id, sport, km::float8 km, to_char(occurred_on,'YYYY-MM-DD') d,
            note, source, points::float8 points, elevation_m::float8 elev, open_water,
            to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') created
       from activities`);
  const activities: Activity[] = actRows.map((r) => ({
    id: r.id, athleteId: r.athlete_id, sport: r.sport, km: r.km, occurredOn: r.d,
    note: r.note, source: r.source, points: r.points, elevationM: r.elev,
    openWater: r.open_water ?? null, movingSeconds: null, createdAt: r.created,
  }));

  const { rows: sRows } = await pool.query("select data from settings where id = 1");
  const stored = (sRows[0]?.data ?? {}) as Partial<Settings>;
  const after: Settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    rateChanges: stored.rateChanges?.length ? stored.rateChanges : DEFAULT_SETTINGS.rateChanges,
    runAscentMetresPerKm: 100,
  };
  const before: Settings = { ...after, runAscentMetresPerKm: 0 };

  const goal = after.weeklyGoal;
  const weeks = [...new Set(activities.map((a) => weekStart(a.occurredOn)))].sort();
  const runsWithAscent = activities.filter((a) => a.sport === "run" && (a.elevationM ?? 0) > 0);
  console.log(
    `${activities.length} activities, ${activities.filter((a) => a.sport === "run").length} runs, ` +
    `${runsWithAscent.length} of them with a recorded ascent\n`);

  let flips = 0;
  console.log("week        athlete    before   after    change   quota");
  for (const wk of weeks) {
    const range: [string, string] = [wk, weekEnd(wk)];
    const b = standingsForRange(athletes, activities, before, range);
    const a = standingsForRange(athletes, activities, after, range);
    for (const row of a) {
      const was = b.find((x) => x.athlete.id === row.athlete.id)!;
      const d = row.points - was.points;
      if (Math.abs(d) < 0.005) continue;
      const hitBefore = was.points >= goal, hitAfter = row.points >= goal;
      const flag = hitBefore !== hitAfter ? (hitAfter ? "  <-- NOW PASSES" : "  <-- NOW FAILS") : "";
      if (flag) flips++;
      console.log(
        `${wk}  ${row.athlete.name.padEnd(9)} ${was.points.toFixed(1).padStart(7)} ` +
        `${row.points.toFixed(1).padStart(7)} ${("+" + d.toFixed(1)).padStart(8)}   ` +
        `${hitBefore ? "hit" : "missed"}->${hitAfter ? "hit" : "missed"}${flag}`);
    }
  }
  console.log(`\nweeks whose quota outcome changes: ${flips}`);
  await pool.end();

}

main().catch((e) => { console.error(e); process.exit(1); });
