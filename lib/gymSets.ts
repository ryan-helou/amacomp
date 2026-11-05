import { MAX_SETS } from "./validate";

/**
 * The set count written in a Strava description, or null if it names none.
 *
 * Strava's API doesn't share the sets an athlete logs in the Strava app's
 * strength tracker (checked 2026-11-05: an activity with 9 logged sets comes
 * back with nothing but its duration). What it does share is the description,
 * and people write their workout there:
 *
 *   Lat pulldown — 2 sets
 *   Tibialis raise 1 set
 *   Bench 3x8
 *
 * One count per line: "N set(s)" wins, otherwise the N of an "N x M" (sets ×
 * reps). Lines naming neither add nothing. Null rather than 0 when nothing was
 * found, because "not written down" is different from "did no sets" — the
 * athlete still gets asked.
 */
export function setsFromDescription(description: string | null | undefined): number | null {
  if (!description) return null;
  let total = 0;
  let found = false;
  for (const line of description.split(/\r?\n/)) {
    const named = /(\d{1,2})\s*sets?\b/i.exec(line);
    const grid = named ? null : /\b(\d{1,2})\s*[x×]\s*\d{1,3}\b/i.exec(line);
    const n = Number((named ?? grid)?.[1]);
    if (!Number.isFinite(n) || n <= 0 || n > 20) continue;
    total += n;
    found = true;
  }
  return found ? Math.min(total, MAX_SETS) : null;
}
