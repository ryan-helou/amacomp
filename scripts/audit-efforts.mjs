/**
 * Read-only audit of the stored personal bests.
 *
 * Prints every record the Records tab would show, alongside the pace or W/kg it
 * implies, so an implausible one is obvious at a glance rather than having to be
 * spotted on a phone. Touches nothing.
 */
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});

const RUN = [100, 400, 1000, 1609.34, 3218.69, 5000, 10000, 15000, 21097.5, 30000, 42195];
const SWIM = [100, 250, 500, 1000, 1500, 1900, 3800];
const BIKE = [15, 30, 60, 300, 600, 900, 1800, 2700, 3600, 5400, 7200, 10800];

function pace(sec, m, per) {
  const p = (sec / m) * per;
  return `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, "0")}`;
}
function dur(s) {
  if (s < 60) return `${s.toFixed(1)}s`;
  const w = Math.round(s);
  const h = Math.floor(w / 3600), m = Math.floor((w % 3600) / 60), x = w % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`
           : `${m}:${String(x).padStart(2, "0")}`;
}

const { rows: athletes } = await pool.query("select id, name, weight_kg from athletes");
const byId = new Map(athletes.map((a) => [a.id, a]));
const { rows } = await pool.query(
  `select strava_id, athlete_id, sport, to_char(occurred_on,'YYYY-MM-DD') d, bests, weight_kg
     from strava_efforts order by occurred_on`,
);

console.log(`athletes: ${athletes.map((a) => `${a.name}(${a.weight_kg ?? "no wt"})`).join(", ")}`);
console.log(`effort rows: ${rows.length}`);
const bySport = {};
for (const r of rows) (bySport[r.sport] ??= []).push(r);
for (const [s, rs] of Object.entries(bySport)) {
  const withBests = rs.filter((r) => Object.keys(r.bests || {}).length > 0);
  console.log(`  ${s}: ${rs.length} rows, ${withBests.length} with bests`);
}

for (const [sport, targets, per] of [["run", RUN, 1000], ["swim", SWIM, 100]]) {
  console.log(`\n===== ${sport.toUpperCase()} =====`);
  for (const t of targets) {
    const key = `${sport}:${t}`;
    const best = new Map();
    for (const r of rows) {
      if (r.sport !== sport) continue;
      const v = r.bests?.[key];
      if (typeof v !== "number" || v <= 0) continue;
      const cur = best.get(r.athlete_id);
      if (!cur || v < cur.v) best.set(r.athlete_id, { v, d: r.d, id: r.strava_id });
    }
    const list = [...best.entries()].sort((a, b) => a[1].v - b[1].v);
    if (!list.length) { console.log(`  ${String(t).padStart(8)}  —`); continue; }
    const [aid, e] = list[0];
    console.log(
      `  ${String(t).padStart(8)}  ${dur(e.v).padStart(9)}  ${pace(e.v, t, per)}${per === 1000 ? "/km" : "/100m"}` +
      `  ${(byId.get(aid)?.name ?? "?").padEnd(10)} ${e.d}  strava:${e.id}`,
    );
  }
}

console.log(`\n===== BIKE (W/kg) =====`);
for (const t of BIKE) {
  const key = `bike:${t}`;
  const best = new Map();
  for (const r of rows) {
    if (r.sport !== "bike") continue;
    const w = r.bests?.[key];
    const kg = r.weight_kg ? Number(r.weight_kg) : null;
    if (typeof w !== "number" || w <= 0 || !kg) continue;
    const v = w / kg;
    const cur = best.get(r.athlete_id);
    if (!cur || v > cur.v) best.set(r.athlete_id, { v, w, kg, d: r.d, id: r.strava_id });
  }
  const list = [...best.entries()].sort((a, b) => b[1].v - a[1].v);
  if (!list.length) { console.log(`  ${String(t).padStart(6)}s  —`); continue; }
  const [aid, e] = list[0];
  console.log(
    `  ${String(t).padStart(6)}s  ${e.v.toFixed(2)} W/kg  ${Math.round(e.w)}W / ${e.kg}kg` +
    `  ${(byId.get(aid)?.name ?? "?").padEnd(10)} ${e.d}  strava:${e.id}`,
  );
}

await pool.end();
