/**
 * Did the weekly push jobs actually fire?
 *
 * Each one writes an idempotency marker into `meta` before it sends, so the
 * markers are a complete, honest record of which scheduled runs landed. Six
 * weeks of a season should leave a matching row per week per job. Read-only.
 */
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});
const q = (s) => pool.query(s).then((r) => r.rows);

console.log("=== every meta marker ===");
console.table(await q(`select key, value from meta order by key`));

console.log("\n=== weeks in the season vs markers that exist ===");
console.table(
  await q(`with weeks as (
      select generate_series(date '2026-08-03', date '2026-09-07', interval '7 day')::date wk)
    select to_char(wk,'YYYY-MM-DD') week,
      exists(select 1 from meta where key = 'results-'  || to_char(wk,'YYYY-MM-DD')) results_sent,
      exists(select 1 from meta where key = 'midweek-'  || to_char(wk,'YYYY-MM-DD')) midweek_sent,
      exists(select 1 from meta where key = 'deadline-' || to_char(wk,'YYYY-MM-DD')) deadline_sent
    from weeks order by wk`),
);

console.log("\n=== unclassified swims, by date (open water only pays more from 31 Aug) ===");
console.table(
  await q(`select a.name, to_char(x.occurred_on,'YYYY-MM-DD') d, x.km::float8 km, x.source
     from activities x join athletes a on a.id = x.athlete_id
    where x.sport='swim' and x.open_water is null
    order by x.occurred_on`),
);

console.log("\n=== strava activities with no extracted efforts, by sport ===");
console.table(
  await q(`select a.name, x.sport, count(*) n
     from activities x join athletes a on a.id = x.athlete_id
    where x.source = 'strava'
      and not exists (select 1 from strava_efforts e
                       where e.athlete_id = x.athlete_id
                         and e.occurred_on = x.occurred_on
                         and e.sport = x.sport)
    group by 1,2 order by 1,2`),
);

await pool.end();
