/** What the run-in card is showing right now, from live data. Read-only. */
import pg from "pg";
import { seasonRace, FORM_DAYS } from "../lib/race.ts";
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

const today = process.argv[2] || "2026-09-08";
const r = seasonRace(athletes, activities, settings, today);

console.log(`as of ${today} · ${r.season.label} ${r.season.start} – ${r.season.end}`);
console.log(`${r.daysGone} days gone · ${r.daysLeft} days left · form window ${r.formDays} days (max ${FORM_DAYS})`);
console.log(`margin ${r.margin.toFixed(1)} · lead changes on projection: ${r.leadChanges}\n`);
console.log("     name        points  behind   form pts   rate/day   projected  proj rank  need/day");
for (const row of r.rows) {
  console.log(
    `  ${String(row.rank).padStart(2)}  ${row.athlete.name.padEnd(10)}` +
      `${row.points.toFixed(0).padStart(7)}` +
      `${row.behind.toFixed(0).padStart(8)}` +
      `${row.formPoints.toFixed(0).padStart(11)}` +
      `${row.rate.toFixed(1).padStart(11)}` +
      `${row.projected.toFixed(0).padStart(12)}` +
      `${String(row.projectedRank).padStart(11)}` +
      `${(row.needPerDay === null ? "—" : row.needPerDay.toFixed(1)).padStart(10)}`,
  );
}
await pool.end();
