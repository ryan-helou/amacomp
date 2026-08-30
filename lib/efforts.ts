import type { Sport } from "./types";

/**
 * Personal bests, computed from Strava activity streams.
 *
 * None of this can come from what the app already stores. An `activities` row
 * holds kilometres, ascent and a date — enough to score the competition, and
 * nowhere near enough to say how fast someone covered 5 km or what they held for
 * five minutes. So the bests are extracted from the second-by-second streams
 * (`time`, `distance`, `watts`) once per activity and cached; this module is the
 * pure maths, deliberately free of Strava and of the database so it can be
 * tested against streams written by hand.
 *
 * Two shapes of record:
 *   - distance sports (run, swim) — the FASTEST time to cover a distance;
 *   - cycling — the HIGHEST average power held for a duration, over body weight.
 */

/** A break longer than this ends a segment, FOR POWER ONLY. Watts are held from
 *  each sample to the next, so a gap would otherwise fabricate energy: a stopped
 *  clock at a café with the last sample reading 250 W would bank it for the
 *  whole break. Distance does not use this — see `bestTimeForDistance`. */
const MAX_SAMPLE_GAP_S = 10;

/**
 * The fastest a sample step can plausibly be before it is a recording artifact
 * rather than an athlete. GPS reacquisition can add tens of metres between two
 * samples, which would otherwise read as a blistering short-distance best.
 *
 * Set well above what a human does — the 100 m world record averages about
 * 10.4 m/s — so this rejects teleports without ever touching a real sprint.
 */
const MAX_PLAUSIBLE_MPS: Record<string, number> = { run: 12, swim: 3 };

export interface Streams {
  /** Elapsed seconds from the start, non-decreasing. */
  time: number[];
  /** Cumulative metres, non-decreasing. Absent for a session with no GPS. */
  distance?: number[];
  /** Instantaneous watts, aligned with `time`. Only present when the ride was
   *  recorded with a power meter. */
  watts?: number[];
}

/** Cycling: the durations a power curve is quoted at, in seconds. */
export const BIKE_WINDOWS_S = [
  15, 30, 60, 300, 600, 900, 1800, 2700, 3600, 5400, 7200, 10800,
] as const;

/**
 * Running: the distances a personal best is quoted at, in metres.
 *
 * 100 m is deliberately absent. Nobody records a 100 m sprint as an activity, so
 * the row was really "the fastest 100 m found inside some longer run" — which
 * for these athletes landed at 3-4 m/s, i.e. jogging, and measured something
 * different from every other row on the ladder. It also could not be
 * cross-checked, Strava publishing no 100 m best effort of its own. 400 m is
 * where both the distance and the verification start being real.
 */
export const RUN_DISTANCES_M = [
  400, 1000, 1609.34, 3218.69, 5000, 10000, 15000, 21097.5, 30000, 42195,
] as const;

/** Swimming: the distances a personal best is quoted at, in metres. */
export const SWIM_DISTANCES_M = [100, 250, 500, 1000, 1500, 1900, 3800] as const;

/** Human labels, kept beside the numbers so the UI never re-derives them. */
export const BIKE_WINDOW_LABEL: Record<number, string> = {
  15: "15s", 30: "30s", 60: "1m", 300: "5m", 600: "10m", 900: "15m",
  1800: "30m", 2700: "45m", 3600: "60m", 5400: "90m", 7200: "120m", 10800: "180m",
};

export const RUN_DISTANCE_LABEL: Record<number, string> = {
  400: "400 m", 1000: "1 km", 1609.34: "1 mile", 3218.69: "2 miles",
  5000: "5 km", 10000: "10 km", 15000: "15 km", 21097.5: "21.1 km",
  30000: "30 km", 42195: "42.2 km",
};

export const SWIM_DISTANCE_LABEL: Record<number, string> = {
  100: "100 m", 250: "250 m", 500: "500 m", 1000: "1 km",
  1500: "1.5 km", 1900: "1.9 km", 3800: "3.8 km",
};

/** The distance targets for a sport, or null if it isn't a distance sport here. */
export function distanceTargetsFor(sport: Sport): readonly number[] | null {
  if (sport === "run") return RUN_DISTANCES_M;
  if (sport === "swim") return SWIM_DISTANCES_M;
  return null;
}

/**
 * Split a stream into contiguous segments at any gap over `MAX_SAMPLE_GAP_S`.
 * Returns index ranges `[start, end]` inclusive.
 */
function segments(time: number[]): [number, number][] {
  const out: [number, number][] = [];
  if (time.length === 0) return out;
  let start = 0;
  for (let k = 1; k < time.length; k++) {
    if (time[k] - time[k - 1] > MAX_SAMPLE_GAP_S) {
      if (k - 1 > start) out.push([start, k - 1]);
      start = k;
    }
  }
  if (time.length - 1 > start) out.push([start, time.length - 1]);
  return out;
}

/**
 * The fastest time, in seconds, to cover `target` metres — or null if the
 * session never covered that distance.
 *
 * Two pointers over a non-decreasing distance series. The start edge is
 * interpolated between samples so the window measures the target exactly: at a
 * 1 Hz sample rate a runner covers three metres a tick, and taking the first
 * sample past the line instead would cost a 100 m best several percent.
 *
 * DELIBERATELY NOT SEGMENTED BY TIME GAPS, unlike power. A gap in the time
 * stream only ever ADDS elapsed seconds to a window, so it can make an effort
 * look slower and never faster — there is nothing to protect against. Splitting
 * on gaps did real damage instead: Strava thins the streams of long activities,
 * so a half marathon would break into pieces and, with no single piece covering
 * 21.1 km, the record silently disappeared. That is exactly what happened to a
 * 21.15 km run in production, which produced no half-marathon best at all while
 * a shorter 21.11 km run did.
 *
 * What IS guarded is a distance JUMP: a window containing a step faster than the
 * sport can plausibly move is a GPS artifact, and is excluded.
 */
export function bestTimeForDistance(
  time: number[],
  distance: number[],
  target: number,
  sport: string = "run",
): number | null {
  if (target <= 0) return null;
  const ceiling = MAX_PLAUSIBLE_MPS[sport] ?? MAX_PLAUSIBLE_MPS.run;
  let best: number | null = null;
  {
    const lo0 = 0, hi = time.length - 1;
    let i = lo0;
    // The start of the current stretch containing no implausible step. A window
    // may never reach back across one.
    let clean = 0;
    for (let j = lo0; j <= hi; j++) {
      if (j > 0) {
        const dt = time[j] - time[j - 1];
        const dd = distance[j] - distance[j - 1];
        if (dd > 0 && (dt <= 0 || dd / dt > ceiling)) clean = j;
      }
      if (i < clean) i = clean;
      // Push the start as late as it can go while still covering the target.
      while (i + 1 <= j && distance[j] - distance[i + 1] >= target) i++;
      if (i < clean) i = clean;
      if (distance[j] - distance[i] < target) continue;
      // Exact crossing between sample i and i+1, where the athlete was still
      // exactly `target` short of where they are at j.
      const want = distance[j] - target;
      let tStart = time[i];
      if (i + 1 <= j) {
        const span = distance[i + 1] - distance[i];
        if (span > 0) {
          const frac = Math.min(1, Math.max(0, (want - distance[i]) / span));
          tStart = time[i] + frac * (time[i + 1] - time[i]);
        }
      }
      const elapsed = time[j] - tStart;
      if (elapsed > 0 && (best === null || elapsed < best)) best = elapsed;
    }
  }
  return best;
}

/**
 * The highest average power, in watts, held for exactly `windowS` seconds — or
 * null if no unbroken stretch was that long.
 *
 * Watts are treated as constant from each sample until the next, which makes the
 * energy over any interval a simple integral; the window's start edge is
 * interpolated so it measures the requested duration rather than "at least" it.
 */
export function bestPowerForWindow(
  time: number[],
  watts: number[],
  windowS: number,
): number | null {
  if (windowS <= 0) return null;
  let best: number | null = null;
  for (const [lo, hi] of segments(time)) {
    // Cumulative joules from the segment start, one entry per sample.
    const energy = new Array<number>(hi - lo + 1).fill(0);
    for (let k = lo + 1; k <= hi; k++) {
      const w = Number.isFinite(watts[k - 1]) ? watts[k - 1] : 0;
      energy[k - lo] = energy[k - 1 - lo] + w * (time[k] - time[k - 1]);
    }
    if (time[hi] - time[lo] < windowS) continue;
    let i = lo;
    for (let j = lo; j <= hi; j++) {
      const startT = time[j] - windowS;
      if (startT < time[lo]) continue;
      while (i + 1 <= j && time[i + 1] <= startT) i++;
      // Energy at the exact window start, inside the sample i -> i+1 step.
      const w = Number.isFinite(watts[i]) ? watts[i] : 0;
      const eStart = energy[i - lo] + w * (startT - time[i]);
      const avg = (energy[j - lo] - eStart) / windowS;
      if (Number.isFinite(avg) && avg > 0 && (best === null || avg > best)) best = avg;
    }
  }
  return best;
}

/**
 * Every best this activity produced, keyed for storage.
 *
 * Keys are `"<sport>:<target>"` — `run:5000`, `swim:100`, `bike:300` — so one
 * JSON blob per activity holds the whole curve and adding a target later is a
 * constant change rather than a schema change. Values are seconds for distance
 * sports and watts for cycling.
 */
export function effortsFor(sport: Sport, streams: Streams): Record<string, number> {
  const out: Record<string, number> = {};
  const time = streams.time ?? [];
  if (time.length < 2) return out;

  if (sport === "bike") {
    const watts = streams.watts;
    // No power meter, no power curve. Estimating it from speed would invent
    // numbers nobody rode for, and these are meant to be records.
    if (!watts || watts.length !== time.length) return out;
    for (const windowS of BIKE_WINDOWS_S) {
      const best = bestPowerForWindow(time, watts, windowS);
      if (best !== null) out[`bike:${windowS}`] = Math.round(best * 10) / 10;
    }
    return out;
  }

  const targets = distanceTargetsFor(sport);
  const distance = streams.distance;
  if (!targets || !distance || distance.length !== time.length) return out;
  for (const target of targets) {
    const best = bestTimeForDistance(time, distance, target, sport);
    if (best !== null) out[`${sport}:${target}`] = Math.round(best * 100) / 100;
  }
  return out;
}

// ── Formatting ─────────────────────────────────────────────────────────────

/** `9:58`, `1:04:12`, `58.4s` — the shape a runner expects to read. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) {
    // Sub-minute efforts live or die on tenths.
    return `${(Math.round(seconds * 10) / 10).toFixed(1)}s`;
  }
  const whole = Math.round(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Pace per kilometre for runs, per 100 m for swims — each sport's own idiom. */
export function formatPace(seconds: number, metres: number, sport: Sport): string {
  if (!Number.isFinite(seconds) || metres <= 0) return "—";
  const per = sport === "swim" ? 100 : 1000;
  const paceS = (seconds / metres) * per;
  const m = Math.floor(paceS / 60);
  const s = Math.round(paceS % 60);
  const carry = s === 60;
  const label = sport === "swim" ? "/100m" : "/km";
  return `${carry ? m + 1 : m}:${String(carry ? 0 : s).padStart(2, "0")}${label}`;
}
