/**
 * What the league's data actually looks like, so product decisions come from
 * evidence rather than from what sounds good. Read-only: this script issues
 * SELECTs and nothing else.
 *
 * Run with DATABASE_PUBLIC_URL set.
 */
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});
const q = (s) => pool.query(s).then((r) => r.rows);

console.log("=== tables ===");
console.log(
  (await q(
    `select table_name from information_schema.tables
      where table_schema='public' order by 1`,
  ))
    .map((r) => r.table_name)
    .join(", "),
);

console.log("\n=== athletes ===");
console.table(
  await q(`select a.name, a.weight_kg,
    (select count(*) from activities x where x.athlete_id=a.id) acts,
    (select count(*) from strava_connections s where s.athlete_id=a.id) strava
    from athletes a order by a.name`),
);

console.log("\n=== activity mix ===");
console.table(
  await q(`select sport, source, count(*) n, round(sum(km)::numeric,1) km,
    count(*) filter (where elevation_m is not null) with_elev,
    count(*) filter (where note is not null and note <> '') with_note
    from activities group by 1,2 order by 1,2`),
);

console.log("\n=== per week ===");
console.table(
  await q(`select to_char(date_trunc('week', occurred_on),'YYYY-MM-DD') wk,
    count(distinct athlete_id) athletes, count(*) sessions,
    round(sum(km)::numeric,1) km
    from activities group by 1 order by 1`),
);

console.log("\n=== hour a session is logged (league time) ===");
console.table(
  await q(`select extract(hour from created_at at time zone 'America/Toronto')::int h,
    count(*) n from activities group by 1 order by 1`),
);

console.log("\n=== lag between doing it and logging it (days) ===");
console.table(
  await q(`select (date(created_at at time zone 'America/Toronto') - occurred_on) lag_days,
    count(*) n from activities group by 1 order by 1`),
);

console.log("\n=== efforts coverage ===");
console.table(
  await q(`select count(*) rows_total,
    count(*) filter (where bests::text = '[]' or bests is null) empty
    from activity_efforts`).catch(() => [{ note: "no activity_efforts table" }]),
);

console.log("\n=== settings ===");
console.log(JSON.stringify((await q(`select data from settings where id=1`))[0]?.data, null, 1));

console.log("\n=== push subscriptions ===");
console.table(await q(`select count(*) n from push_subscriptions`).catch(() => [{ n: "none" }]));

await pool.end();
