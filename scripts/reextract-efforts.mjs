/**
 * Clear the cached personal bests so they re-derive from Strava.
 *
 * The rows in `strava_efforts` are 100% derived — every one of them can be
 * rebuilt from the streams they came from — but they were extracted under an
 * algorithm that split a run at any gap over ten seconds, which truncated long
 * efforts and lost a real half-marathon record. Nothing short of re-extraction
 * fixes rows that already exist, because the sync skips any activity it has
 * already looked at.
 *
 * Backs up to a JSON file BEFORE deleting anything, and prints the counts either
 * side so the delete is auditable. Pass --confirm to actually run it.
 */
import fs from "node:fs";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});

const confirm = process.argv.includes("--confirm");

const { rows } = await pool.query(
  `select strava_id, athlete_id, sport, to_char(occurred_on,'YYYY-MM-DD') occurred_on,
          bests, weight_kg from strava_efforts order by strava_id`,
);
console.log(`rows currently stored: ${rows.length}`);
const withBests = rows.filter((r) => Object.keys(r.bests || {}).length > 0).length;
console.log(`  of which carry at least one best: ${withBests}`);

const stamp = process.env.BACKUP_STAMP || "backup";
const file = `/tmp/amacomp-efforts-${stamp}.json`;
fs.writeFileSync(file, JSON.stringify(rows, null, 2));
console.log(`backed up to ${file} (${fs.statSync(file).size} bytes)`);

if (!confirm) {
  console.log("\nDRY RUN — nothing deleted. Re-run with --confirm.");
  await pool.end();
  process.exit(0);
}

const del = await pool.query("DELETE FROM strava_efforts");
console.log(`deleted ${del.rowCount} rows; the cron will re-derive them from Strava.`);
const { rows: after } = await pool.query("select count(*)::int n from strava_efforts");
console.log(`rows now: ${after[0].n}`);
await pool.end();
