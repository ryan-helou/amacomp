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

export function parseKm(value: unknown): number | null {
  const km = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(km) || km <= 0 || km > MAX_KM) return null;
  return Math.round(km * 1000) / 1000; // metre precision is plenty
}

export function parseNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const note = value.trim().slice(0, MAX_NOTE);
  return note || null;
}
