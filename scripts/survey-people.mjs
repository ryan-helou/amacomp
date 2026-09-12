/**
 * What the season says about each athlete. Read-only.
 *
 * Points are derived the same way the app does it (rates in force on the
 * session's own day), so the numbers here match the boards rather than a
 * second, drifting definition of a point.
 */
import pg from "pg";
import { pointsFor, elevationPointsFor } from "../lib/scoring.ts";
import { DEFAULT_SETTINGS, isGrant, isExcuse } from "../lib/types.ts";
import { weekStart, addDays } from "../lib/dates.ts";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});

const athletes = (await pool.query("select id, name from athletes order by name")).rows;
const stored = (await pool.query("select data from settings where id = 1")).rows[0]?.data ?? {};
const settings = { ...DEFAULT_SETTINGS, ...stored };
const goal = settings.weeklyGoal ?? 100;

const acts = (
  await pool.query(`select id, athlete_id, sport, km::float8 km,
      to_char(occurred_on,'YYYY-MM-DD') d, note, source,
      elevation_m::float8 elev, open_water,
      to_char(created_at at time zone 'America/Toronto','YYYY-MM-DD HH24:MI') created_local
    from activities order by occurred_on`)
).rows;

const pts = (a) =>
  pointsFor(a.km ?? 0, a.sport, settings, a.d, a.open_water) +
  elevationPointsFor(a.elev ?? null, a.sport, settings, a.d);

// Every week the league has been running.
const weeks = [...new Set(acts.map((a) => weekStart(a.d)))].sort();
console.log(`${acts.length} sessions · ${athletes.length} athletes · weeks ${weeks[0]} → ${weeks[weeks.length - 1]}\n`);

for (const ath of athletes) {
  const mine = acts.filter((a) => a.athlete_id === ath.id);
  const real = mine.filter((a) => !isGrant({ source: a.source }) && !isExcuse({ source: a.source }));
  if (mine.length === 0) {
    console.log(`${ath.name.padEnd(9)} — nothing logged at all\n`);
    continue;
  }

  const bySport = {};
  let total = 0;
  for (const a of real) {
    const p = pts(a);
    bySport[a.sport] = (bySport[a.sport] ?? 0) + p;
    total += p;
  }
  const grants = mine.filter((a) => isGrant({ source: a.source }));
  const excuses = mine.filter((a) => isExcuse({ source: a.source }));
  const strava = real.filter((a) => a.source === "strava").length;

  // Weeks met, and the shape of each week.
  const weekly = weeks.map((w) => {
    const end = addDays(w, 6);
    const inWeek = mine.filter((a) => a.d >= w && a.d <= end);
    const earned = inWeek
      .filter((a) => !isGrant({ source: a.source }) && !isExcuse({ source: a.source }))
      .reduce((s, a) => s + pts(a), 0);
    const granted = inWeek
      .filter((a) => isGrant({ source: a.source }) || isExcuse({ source: a.source }))
      .reduce((s, a) => s + pts(a), 0);
    return { w, earned, granted, sessions: inWeek.length };
  });
  const met = weekly.filter((x) => x.earned + x.granted >= goal).length;
  const metEarned = weekly.filter((x) => x.earned >= goal).length;

  // When the work actually happens: day of week, and how late it is logged.
  const dow = [0, 0, 0, 0, 0, 0, 0];
  for (const a of real) dow[(new Date(`${a.d}T12:00:00Z`).getUTCDay() + 6) % 7] += pts(a);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const lateWeek = dow[5] + dow[6];
  const share = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Backfilling: days between the session and the moment it was logged.
  const lag = real
    .filter((a) => a.created_local)
    .map((a) => Math.round((new Date(a.created_local.slice(0, 10)) - new Date(a.d)) / 86400000));
  const sameDay = lag.filter((l) => l <= 0).length;

  const sizes = real.map((a) => pts(a)).sort((x, y) => y - x);
  const biggest = sizes[0] ?? 0;
  const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  const activeDays = new Set(real.map((a) => a.d)).size;

  const half = Math.ceil(weekly.length / 2);
  const first = weekly.slice(0, half).reduce((s, x) => s + x.earned, 0) / half;
  const last = weekly.slice(half).reduce((s, x) => s + x.earned, 0) / (weekly.length - half || 1);

  console.log(`${ath.name.toUpperCase()}`);
  console.log(`  ${Math.round(total)} pts earned · ${real.length} sessions · ${activeDays} active days`);
  console.log(
    `  mix: ${Object.entries(bySport)
      .sort((a, b) => b[1] - a[1])
      .map(([s, p]) => `${s} ${share(p)}%`)
      .join(" · ") || "—"}`,
  );
  console.log(`  quota: met ${met}/${weekly.length} weeks (${metEarned} on earned points alone)`);
  console.log(`  grants: ${grants.length} · excuses: ${excuses.length} · from Strava: ${strava}/${real.length}`);
  console.log(`  session size: biggest ${Math.round(biggest)} pts, median ${Math.round(median)}`);
  console.log(`  weekend share: ${share(lateWeek)}% of points land Sat–Sun`);
  console.log(`  busiest day: ${DAYS[dow.indexOf(Math.max(...dow))]}`);
  console.log(`  logged same day: ${sameDay}/${lag.length}`);
  console.log(`  first half ${Math.round(first)} pts/wk → second half ${Math.round(last)} pts/wk`);
  console.log(
    `  weeks: ${weekly.map((x) => Math.round(x.earned + x.granted)).join(", ")}`,
  );
  console.log();
}

await pool.end();
