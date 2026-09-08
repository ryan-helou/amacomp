/**
 * The season as it actually stands, plus the axes the app doesn't currently
 * compete on. Read-only — this is input to "what's worth building", not a fix.
 */
import pg from "pg";
import { standingsForRange } from "../lib/scoring.ts";
import { DEFAULT_SETTINGS } from "../lib/types.ts";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});

const athletes = (await pool.query("select id, name from athletes order by name")).rows.map((r) => ({
  id: r.id, name: r.name, weightKg: null,
  avatarColor: null, avatarGlyph: null, avatarUrl: null,
}));
const activities = (
  await pool.query(`select id, athlete_id, sport, km::float8 km,
      to_char(occurred_on,'YYYY-MM-DD') d, note, source, points::float8 points,
      elevation_m::float8 elev, open_water,
      to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') created
    from activities`)
).rows.map((r) => ({
  id: r.id, athleteId: r.athlete_id, sport: r.sport, km: r.km, occurredOn: r.d,
  note: r.note, source: r.source, points: r.points, elevationM: r.elev,
  openWater: r.open_water ?? null, createdAt: r.created,
}));
const stored = (await pool.query("select data from settings where id = 1")).rows[0]?.data ?? {};
const settings = { ...DEFAULT_SETTINGS, ...stored };

console.log("=== Season 1 table (3 Aug – 30 Sep), as it stands ===");
const table = standingsForRange(athletes, activities, settings, ["2026-08-03", "2026-09-30"]);
const lead = table[0]?.points ?? 0;
for (const r of table) {
  console.log(
    `  ${String(r.rank).padStart(2)}  ${r.athlete.name.padEnd(9)} ${Math.round(r.points)
      .toString()
      .padStart(5)}   ${r.rank === 1 ? "" : `-${Math.round(lead - r.points)}`}`,
  );
}

console.log("\n=== elevation: an axis nobody competes on (metres climbed) ===");
console.table(
  (
    await pool.query(`select a.name,
        round(sum(x.elevation_m) filter (where x.sport='bike'))::int bike_m,
        round(sum(x.elevation_m) filter (where x.sport='run'))::int run_m,
        round(sum(x.elevation_m))::int total_m
      from activities x join athletes a on a.id=x.athlete_id
      where x.elevation_m is not null group by 1 order by 4 desc nulls last`)
  ).rows,
);

console.log("\n=== sport mix per athlete (km, and gym sessions) ===");
console.table(
  (
    await pool.query(`select a.name,
        round(sum(x.km) filter (where x.sport='swim')::numeric,1) swim_km,
        round(sum(x.km) filter (where x.sport='bike')::numeric,1) bike_km,
        round(sum(x.km) filter (where x.sport='run')::numeric,1) run_km,
        count(*) filter (where x.sport='gym') gym
      from activities x join athletes a on a.id=x.athlete_id
      where x.source <> 'excuse' group by 1 order by 1`)
  ).rows,
);

console.log("\n=== biggest single sessions (the log has no 'best ever' anywhere) ===");
console.table(
  (
    await pool.query(`select a.name, x.sport, x.km::float8 km,
        round(x.elevation_m)::int elev, to_char(x.occurred_on,'YYYY-MM-DD') d,
        coalesce(x.note,'') note
      from activities x join athletes a on a.id=x.athlete_id
      where x.source <> 'excuse'
      order by case x.sport when 'swim' then x.km*20 when 'run' then x.km*5
                            when 'bike' then x.km else x.km*5 end desc
      limit 8`)
  ).rows,
);

console.log("\n=== consistency: gap between sessions ===");
console.table(
  (
    await pool.query(`with d as (
        select athlete_id, occurred_on,
               occurred_on - lag(occurred_on) over (partition by athlete_id order by occurred_on) gap
          from activities where source <> 'excuse')
      select a.name, count(*) sessions, round(avg(d.gap)::numeric,2) avg_gap_days,
             max(d.gap) longest_gap
        from d join athletes a on a.id=d.athlete_id group by 1 order by 3`)
  ).rows,
);

await pool.end();
