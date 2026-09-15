/**
 * Make every athlete their own "AmaComp Steps" shortcut, code baked in.
 *
 *   DATABASE_PUBLIC_URL=… node scripts/make-step-shortcuts.mjs --out <dir> [--only Ryan]
 *
 * For each athlete: issue a fresh step code, build and sign a shortcut with it
 * (scripts/build-steps-shortcut.py — needs this Mac, signed into iCloud), and
 * store the file behind a secret key. Settings → Steps then shows them an
 * "Add" button; a copy of each file is also written to --out, to send by hand.
 *
 * WRITES to the database, and replaces each athlete's step code: a shortcut
 * set up with an earlier code stops reporting until the new one is added.
 * --only takes an exact name (Jona and Jonah are different people).
 */
import pg from "pg";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const BASE = "https://amagohtrain-production.up.railway.app";
const outDir = arg("--out");
const only = arg("--only");
if (!outDir) throw new Error("--out <dir> is required");
mkdirSync(outDir, { recursive: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } });
// The same columns the app adds on boot, in case this runs before a deploy.
await pool.query(`ALTER TABLE step_tokens ADD COLUMN IF NOT EXISTS shortcut BYTEA`);
await pool.query(`ALTER TABLE step_tokens ADD COLUMN IF NOT EXISTS shortcut_key TEXT UNIQUE`);

let athletes = (await pool.query(`SELECT id, name FROM athletes ORDER BY name`)).rows;
if (only) {
  athletes = athletes.filter((a) => a.name === only);
  if (athletes.length !== 1) throw new Error(`no athlete named exactly "${only}"`);
}

for (const a of athletes) {
  const token = randomBytes(24).toString("base64url");
  const file = join(outDir, `AmaComp Steps - ${a.name}.shortcut`);
  execFileSync("python3", ["scripts/build-steps-shortcut.py", "--token", token, "--out", file], { stdio: "inherit" });
  const bytes = readFileSync(file);
  await pool.query(
    `INSERT INTO step_tokens (athlete_id, token_hash, created_at, last_used_at, shortcut, shortcut_key)
     VALUES ($1, $2, now(), NULL, $3, $4)
     ON CONFLICT (athlete_id) DO UPDATE
       SET token_hash = EXCLUDED.token_hash, created_at = now(), last_used_at = NULL,
           shortcut = EXCLUDED.shortcut, shortcut_key = EXCLUDED.shortcut_key`,
    [a.id, createHash("sha256").update(token).digest("hex"), bytes, randomBytes(24).toString("base64url")],
  );
  // Prove the live server takes the code: an empty report is turned down as
  // empty (400), not as an unknown code (401) — and nothing is written.
  const check = await fetch(`${BASE}/api/steps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (check.status !== 400) throw new Error(`${a.name}: server answered ${check.status} to the new code`);
  console.log(`${a.name}: ${bytes.length} bytes, code accepted`);
}
await pool.end();
