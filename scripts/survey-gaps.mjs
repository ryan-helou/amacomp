/**
 * Where the league's data is thin or unreachable — the gaps that decide what is
 * worth building next. Read-only.
 *
 * Run with DATABASE_PUBLIC_URL set.
 */
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});
const q = (s) => pool.query(s).then((r) => r.rows);
const show = async (label, sql) => {
  console.log(`\n=== ${label} ===`);
  try {
    console.table(await q(sql));
  } catch (e) {
    console.log(`  (${e.message.split("\n")[0]})`);
  }
};

await show("push subscribers", `select count(*) n, count(distinct athlete_id) people from push_subs`);
await show("comments", `select count(*) n, max(created_at)::text newest from comments`);
await show("reactions", `select count(*) n, max(created_at)::text newest from reactions`);

await show(
  "swims still unclassified (score as pool, the lower rate)",
  `select a.name, x.source, count(*) n, round(sum(x.km)::numeric,2) km
     from activities x join athletes a on a.id = x.athlete_id
    where x.sport='swim' and x.open_water is null
    group by 1,2 order by 1`,
);

await show(
  "open water so far",
  `select open_water, count(*) n, round(sum(km)::numeric,2) km
     from activities where sport='swim' group by 1 order by 1`,
);

await show(
  "who can appear in the bike record book (needs a weight)",
  `select a.name, a.weight_kg,
     (select count(*) from activities x where x.athlete_id=a.id and x.sport='bike') bike_sessions
     from athletes a order by a.name`,
);

await show(
  "effort extraction coverage per athlete",
  `select a.name,
     count(*) filter (where x.source='strava') strava_acts,
     (select count(*) from strava_efforts e where e.athlete_id = a.id) effort_rows
     from athletes a left join activities x on x.athlete_id = a.id
    group by a.id, a.name order by a.name`,
);

await show(
  "strava_efforts shape",
  `select column_name, data_type from information_schema.columns
    where table_name='strava_efforts' order by ordinal_position`,
);

await show(
  "longest gaps between sessions per athlete (days)",
  `with d as (
     select athlete_id, occurred_on,
            occurred_on - lag(occurred_on) over (partition by athlete_id order by occurred_on) gap
       from activities where source <> 'excuse')
   select a.name, max(d.gap) longest_gap_days, round(avg(d.gap)::numeric,2) avg_gap
     from d join athletes a on a.id=d.athlete_id group by 1 order by 2 desc`,
);

await show(
  "weekly quota outcomes so far (points from the app's own rules are not used here — raw sessions only)",
  `select a.name,
     count(distinct date_trunc('week', x.occurred_on)) weeks_active
     from activities x join athletes a on a.id=x.athlete_id
    where x.source <> 'excuse' group by 1 order by 1`,
);

await pool.end();
