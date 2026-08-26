/**
 * One-off correction (24 Aug 2026), by Ryan's instruction:
 *   1. delete Jona's 10.15 km run — logged in error
 *   2. move his 7.5 km run back into the week of Mon 17 Aug
 *
 * Dry run by default; pass --apply to write. --apply backs the affected rows up
 * to a JSON file first, and does both edits in one transaction.
 *
 *   railway run --service AmagohTrain node scripts/fix-jona-aug24.mjs
 *   railway run --service AmagohTrain node scripts/fix-jona-aug24.mjs --apply
 *
 * Flags: --to=YYYY-MM-DD  target day for the 7.5 (default 2026-08-23)
 *        --since=YYYY-MM-DD  how far back to look for the two runs (default 2026-08-10)
 *        --athlete=Name   (default Jona)
 *
 * Note: deleting a Strava-sourced run is permanent. The strava_imports ledger
 * row is intentionally left in place, so the next sync treats the activity as
 * already imported and won't re-create it.
 */
import fs from "node:fs";
import pg from "pg";

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const APPLY = process.argv.includes("--apply");
const TARGET = arg("to", "2026-08-23");
const SINCE = arg("since", "2026-08-10");
const NAME = arg("athlete", "Jona");
const DELETE_KM = 10.15;
const MOVE_KM = 7.5;
const TOL = 0.05; // display rounds, so match on a window rather than equality

const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
function weekStart(day) {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); // Mon = day one
  return dt.toISOString().slice(0, 10);
}

if (weekStart(TARGET) !== "2026-08-17") {
  console.error(`Refusing: --to=${TARGET} is in the week of ${weekStart(TARGET)}, not 2026-08-17.`);
  process.exit(1);
}

// DATABASE_URL is Railway's internal hostname, which only resolves inside their
// network; run this against the Postgres service so the public proxy URL is
// present:  railway run --service Postgres node scripts/fix-jona-aug24.mjs
const conn = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!conn) {
  console.error("No DATABASE_PUBLIC_URL/DATABASE_URL in the environment.");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });

/** Exactly one match, or bail loudly — never guess which row to delete. */
function pickOne(rows, km, label) {
  const hits = rows.filter((r) => Math.abs(Number(r.km) - km) <= TOL);
  if (hits.length === 1) return hits[0];
  console.error(`\nRefusing: expected exactly 1 ${label} (${km} km ±${TOL}), found ${hits.length}.`);
  for (const h of hits) console.error(`   ${iso(h.occurred_on)}  ${h.km} km  src=${h.source}  [${h.id}]`);
  if (!hits.length) console.error("   Widen the window with --since=YYYY-MM-DD, or check the distance.");
  return null;
}

try {
  if (process.argv.includes("--list")) {
    const { rows: all } = await pool.query(
      `select a.id, a.name, a.reset_hour,
              (select count(*) from activities x
                where x.athlete_id = a.id and x.occurred_on >= $1) as recent
         from athletes a order by a.name`, [SINCE]);
    console.log(`\nAthletes (activity count since ${SINCE}):`);
    for (const a of all) {
      console.log(`   ${a.name.padEnd(14)} reset_hour=${a.reset_hour}  ${a.recent} since ${SINCE}  [${a.id}]`);
      const { rows: rs } = await pool.query(
        `select sport, km, occurred_on, note, source from activities
          where athlete_id = $1 and occurred_on >= $2 order by occurred_on`, [a.id, SINCE]);
      for (const r of rs) {
        console.log(`      ${iso(r.occurred_on)}  wk ${weekStart(iso(r.occurred_on))}  ${r.sport.padEnd(5)} ${String(r.km).padStart(7)} km  src=${(r.source||"").padEnd(7)}  ${r.note ?? ""}`);
      }
    }
    console.log("");
    process.exit(0);
  }

  const exact = NAME.endsWith("!");
  const { rows: ath } = await pool.query(
    exact
      ? "select id, name, reset_hour from athletes where lower(name) = lower($1)"
      : "select id, name, reset_hour from athletes where lower(name) like lower($1)",
    [exact ? NAME.slice(0, -1) : `${NAME}%`],
  );
  if (ath.length !== 1) {
    if (ath.length > 1) {
      console.error(`\nAmbiguous — "${NAME}" matches ${ath.length} athletes:`);
      for (const a of ath) console.error(`   ${a.name}  [${a.id}]`);
      console.error(`Disambiguate with --athlete='Exact Name!' (trailing ! = exact match).`);
    }
    throw new Error(`Expected 1 athlete matching "${NAME}", found ${ath.length}.`);
  }
  const jona = ath[0];

  const { rows } = await pool.query(
    `select id, sport, km, occurred_on, note, source, points, created_at
       from activities
      where athlete_id = $1 and sport = 'run' and occurred_on >= $2
      order by occurred_on, created_at`,
    [jona.id, SINCE],
  );

  console.log(`\n${jona.name} (reset_hour=${jona.reset_hour}) — runs since ${SINCE}:`);
  for (const r of rows) {
    console.log(`   ${iso(r.occurred_on)}  wk ${weekStart(iso(r.occurred_on))}  ${String(r.km).padStart(7)} km  src=${(r.source || "").padEnd(7)}  ${r.note ?? ""}  [${r.id}]`);
  }

  const toDelete = pickOne(rows, DELETE_KM, "run to delete");
  const toMove = pickOne(rows, MOVE_KM, "run to move");
  if (!toDelete || !toMove) process.exit(1);
  if (toDelete.id === toMove.id) throw new Error("Same row matched both — aborting.");

  console.log("\nPlanned changes:");
  console.log(`   DELETE  ${toDelete.km} km  ${iso(toDelete.occurred_on)} (wk ${weekStart(iso(toDelete.occurred_on))})  [${toDelete.id}]`);
  console.log(`   MOVE    ${toMove.km} km  ${iso(toMove.occurred_on)} (wk ${weekStart(iso(toMove.occurred_on))})`);
  console.log(`                    ->  ${TARGET} (wk ${weekStart(TARGET)})  [${toMove.id}]`);

  if (!APPLY) {
    console.log("\nDry run — nothing written. Re-run with --apply to commit.\n");
    process.exit(0);
  }

  const backup = `/tmp/amagoh-fix-${Date.now()}.json`;
  fs.writeFileSync(backup, JSON.stringify({ athlete: jona, toDelete, toMove }, null, 2));
  console.log(`\nBacked up affected rows to ${backup}`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const del = await client.query("DELETE FROM activities WHERE id = $1", [toDelete.id]);
    const upd = await client.query(
      "UPDATE activities SET occurred_on = $1, updated_at = now() WHERE id = $2",
      [TARGET, toMove.id],
    );
    if (del.rowCount !== 1 || upd.rowCount !== 1) {
      throw new Error(`Unexpected row counts (delete=${del.rowCount}, update=${upd.rowCount}) — rolling back.`);
    }
    await client.query("COMMIT");
    console.log("Applied: 1 deleted, 1 moved.\n");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
} catch (e) {
  console.error(`\n${e.message}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
