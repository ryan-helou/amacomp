/**
 * Weekly quota outcomes for every settled week, using the app's own scoring so
 * the numbers match what the board shows. Read-only.
 *
 * Run with: tsx --conditions=react-server is NOT needed (no server-only imports).
 */
import pg from "pg";
import { standingsForRange } from "../lib/scoring.ts";
import { weekStart, weekEnd } from "../lib/dates.ts";
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
const goal = settings.weeklyGoal;

const weeks = [...new Set(activities.map((a) => weekStart(a.occurredOn)))].sort();
const settled = weeks.filter((w) => w < weekStart("2026-09-08"));

const missedBy = new Map();
console.log(`quota = ${goal} pts · settled weeks: ${settled.length}\n`);
console.log("week        " + athletes.map((a) => a.name.padEnd(10)).join(""));
for (const wk of settled) {
  const rows = standingsForRange(athletes, activities, settings, [wk, weekEnd(wk)]);
  const cells = athletes.map((a) => {
    const r = rows.find((x) => x.athlete.id === a.id);
    const pts = r?.points ?? 0;
    const ok = pts >= goal || r?.excused;
    if (!ok) missedBy.set(a.name, (missedBy.get(a.name) ?? 0) + 1);
    return `${ok ? " " : "✗"}${Math.round(pts)}`.padEnd(10);
  });
  console.log(`${wk}  ${cells.join("")}`);
}

console.log("\nforfeits owed (missed weeks):");
let total = 0;
for (const a of athletes) {
  const n = missedBy.get(a.name) ?? 0;
  total += n;
  console.log(`  ${a.name.padEnd(10)} ${n}`);
}
console.log(`  ${"TOTAL".padEnd(10)} ${total}`);

await pool.end();
