import type { Sport } from "./types";

export const MAX_KM = 1000;
export const MAX_NOTE = 140;

/**
 * Gym is the one flat-scored discipline, so N taps = N × the gym multiplier with
 * nothing to bound it. Past this many gym workouts in a day the extras still get
 * logged — they're a real record of the session — they just stop scoring. The cap
 * is applied at read time in `standingsForRange`, so it lands the same way for a
 * hand-logged workout and a Strava import.
 */
export const MAX_SCORING_GYM_PER_DAY = 2;

/**
 * Distances past this get a "that's a big one — sure?" confirm before they save.
 * Set around the top of what's plausible in one session, not what's impossible:
 * the point is to catch a fat-fingered 1000 instead of 100, not to call anyone a
 * liar. Gym has no distance, so it has no threshold.
 */
export const BIG_SESSION_KM: Record<Sport, number> = {
  swim: 5,
  bike: 200,
  run: 42,
  gym: Infinity,
};

/** The most sets one gym session can claim. A big session is 40; this only
 *  catches a fat-fingered 500. */
export const MAX_SETS = 100;

/** A set count: a whole number 0–MAX_SETS, or null for blank (unknown).
 *  `undefined` means it was supplied and is nonsense. */
export function parseSets(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_SETS) return undefined;
  return n;
}

export function parseKm(value: unknown): number | null {
  const km = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(km) || km <= 0 || km > MAX_KM) return null;
  return Math.round(km * 1000) / 1000; // metre precision is plenty
}

/** Everest is 8,849 m; nothing in one session should approach it. Generous
 *  enough for a big alpine day, tight enough to catch a units mix-up (feet
 *  typed as metres on a long ride lands near this). */
export const MAX_ELEVATION_M = 10000;

/**
 * Metres of ascent. Three-way on purpose, because "blank" and "wrong" must not
 * collapse into the same answer the way they can for km (where null just means
 * invalid):
 *   number    — a valid figure. 0 is kept: a genuinely flat ride is not unknown.
 *   null      — left blank; we don't know the climb, so it scores nothing.
 *   undefined — supplied but unusable (negative, absurd, not a number). Callers
 *               must reject this rather than quietly storing null, or a fat
 *               finger would silently erase a real number.
 */
export function parseElevation(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const m = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(m) || m < 0 || m > MAX_ELEVATION_M) return undefined;
  return Math.round(m * 10) / 10;
}

export function parseNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const note = value.trim().slice(0, MAX_NOTE);
  return note || null;
}
