/** Every swim, with how it is classified. Read-only. */
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});
console.table(
  (
    await pool.query(`select a.name, to_char(x.occurred_on,'YYYY-MM-DD') d,
        x.km::float8 km, x.source, x.open_water, coalesce(x.note,'') note
      from activities x join athletes a on a.id = x.athlete_id
      where x.sport='swim' order by x.occurred_on, a.name`)
  ).rows,
);
await pool.end();
