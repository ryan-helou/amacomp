import type { ActivityEfforts, Sport } from "./types";
import {
  BIKE_DISTANCES_M,
  BIKE_DISTANCE_LABEL,
  BIKE_DIST_PREFIX,
  BIKE_WINDOWS_S,
  BIKE_WINDOW_LABEL,
  RUN_DISTANCES_M,
  RUN_DISTANCE_LABEL,
  SWIM_DISTANCES_M,
  SWIM_DISTANCE_LABEL,
} from "./efforts";

/**
 * Turning stored per-activity bests into the league's record book.
 *
 * Like every other board in this app the maths happens on the client from one
 * payload, so a record is never a stale cached number — it is recomputed from
 * the efforts every render, and a newly synced activity moves it immediately.
 */

/**
 * Which slice of the cycling book (Jona, 2026-11-05: "should there be 2 records
 * pages for outside and trainer?"). A trainer makes speed meaningless and power
 * easy to hold, and most of the league has no meter on the road, so one book
 * pitted the wrong things against each other:
 *   - "trainer" — power, from indoor rides;
 *   - "outside" — speed over each distance, from outdoor rides (everyone has it);
 *   - "outside-power" — power, from outdoor rides with a meter.
 * Run and swim ignore it.
 */
export type BikeBook = "trainer" | "outside" | "outside-power";

/** Lower is better for a time, higher for power. Kept explicit because it drives
 *  both the sort and the "did this beat it" comparison, and getting it backwards
 *  would crown the slowest runner in the league. */
export type Direction = "lower" | "higher";

export interface RecordEntry {
  athleteId: string;
  /** The ranked number: seconds for run/swim, watts per kilo for bike. */
  value: number;
  /** What was actually recorded — seconds, or raw watts before the weight divide. */
  raw: number;
  occurredOn: string;
  /** The weight the W/kg was computed against; null for run and swim. */
  weightKg: number | null;
  /** The activity it was set on. A record reads very differently when you can
   *  see it came off "Brutal interval" rather than just a date. */
  name: string | null;
}

export interface RecordRow {
  /** `"run:5000"` — the same key the efforts are stored under. */
  key: string;
  sport: Sport;
  /** Metres for run/swim, seconds for bike. */
  target: number;
  label: string;
  /** Best first. Empty means nobody in the league has done it yet. */
  entries: RecordEntry[];
}

export function directionFor(sport: Sport, book: BikeBook = "trainer"): Direction {
  return sport === "bike" && book !== "outside" ? "higher" : "lower";
}

/** Whether this book ranks power (W/kg) — the only one that needs a weight. */
export function isPowerBook(sport: Sport, book: BikeBook = "trainer"): boolean {
  return sport === "bike" && book !== "outside";
}

/** The targets and labels a sport's record book is built from. */
export function targetsFor(
  sport: Sport,
  book: BikeBook = "trainer",
): { target: number; label: string; key: string }[] {
  if (sport === "bike" && book === "outside") {
    return BIKE_DISTANCES_M.map((t) => ({
      target: t, label: BIKE_DISTANCE_LABEL[t], key: `${BIKE_DIST_PREFIX}:${t}`,
    }));
  }
  const keyed = (rows: { target: number; label: string }[]) =>
    rows.map((r) => ({ ...r, key: `${sport}:${r.target}` }));
  return keyed(targetsForPlain(sport));
}

function targetsForPlain(sport: Sport): { target: number; label: string }[] {
  if (sport === "bike") {
    return BIKE_WINDOWS_S.map((t) => ({ target: t, label: BIKE_WINDOW_LABEL[t] }));
  }
  if (sport === "run") {
    return RUN_DISTANCES_M.map((t) => ({ target: t, label: RUN_DISTANCE_LABEL[t] }));
  }
  if (sport === "swim") {
    return SWIM_DISTANCES_M.map((t) => ({ target: t, label: SWIM_DISTANCE_LABEL[t] }));
  }
  return [];
}

/**
 * The record book for one sport.
 *
 * Only efforts from `seasonStart` onward count — the records belong to the
 * league, and the league started when it started, so a marathon someone ran the
 * spring before AmaComp existed isn't one of its records.
 *
 * One entry per athlete: their own best, so a strong rider can't fill a row with
 * their five fastest 5 km and push everyone else off it.
 */
export function recordsFor(
  sport: Sport,
  efforts: ActivityEfforts[],
  seasonStart: string,
  /** Each athlete's CURRENT weight, used when the effort has none pinned. */
  weightById: Map<string, number | null> = new Map(),
  /** Cycling only: which slice of the book. Omitted, every ride counts — the
   *  one-book behaviour from before the split. */
  book?: BikeBook,
): RecordRow[] {
  const direction = directionFor(sport, book);
  const power = isPowerBook(sport, book);
  const better = (a: number, b: number) => (direction === "lower" ? a < b : a > b);

  const inScope = efforts.filter(
    (e) => e.sport === sport && e.occurredOn >= seasonStart && inBook(e, book),
  );

  return targetsFor(sport, book).map(({ target, label, key }) => {
    const bestByAthlete = new Map<string, RecordEntry>();

    for (const effort of inScope) {
      const raw = effort.bests[key];
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;

      let value = raw;
      let weightKg: number | null = null;
      if (power) {
        // The weight pinned when the effort was extracted, else the athlete's
        // current one.
        //
        // The fallback is not a nicety. Weight arrives from the same Strava sync
        // that extracts the efforts, so on the first pass there is nothing to
        // pin and every row stores null — which is exactly what happened in
        // production: 103 rows, every one of them null, and a cycling record
        // book that could never show anything no matter who set a weight later.
        // Resolving at read time repairs those rows the moment a weight exists,
        // with no re-sync and no backfill.
        weightKg = effort.weightKg ?? weightById.get(effort.athleteId) ?? null;
        // Still nothing to divide by: the ride happened, but there is no honest
        // number to rank it by, and raw watts would put a heavier rider ahead on
        // a figure that isn't the one being compared.
        if (!weightKg || weightKg <= 0) continue;
        value = raw / weightKg;
      }

      const held = bestByAthlete.get(effort.athleteId);
      if (!held || better(value, held.value)) {
        bestByAthlete.set(effort.athleteId, {
          athleteId: effort.athleteId,
          value,
          raw,
          occurredOn: effort.occurredOn,
          weightKg,
          name: effort.name,
        });
      }
    }

    const entries = [...bestByAthlete.values()].sort(
      (a, b) =>
        (direction === "lower" ? a.value - b.value : b.value - a.value) ||
        // A tie goes to whoever set it first — the record stood until it was beaten.
        a.occurredOn.localeCompare(b.occurredOn),
    );
    return { key, sport, target, label, entries };
  });
}

/**
 * Whether an effort belongs in a cycling book. A ride not yet known to be either
 * (rows extracted before the flag was stored, until the next sync fills it in)
 * is left out of both rather than guessed into one.
 */
function inBook(e: ActivityEfforts, book: BikeBook | undefined): boolean {
  if (e.sport !== "bike" || !book) return true;
  if (book === "trainer") return e.indoor === true;
  return e.indoor === false;
}

/** How many rows in a book anyone has actually set, for the section summary. */
export function filledCount(rows: RecordRow[]): number {
  return rows.filter((r) => r.entries.length > 0).length;
}

/**
 * Whether a sport's record book is empty for a reason worth explaining rather
 * than just being unset — cycling needs a power meter AND a weight, so a league
 * where nobody has either would otherwise just show a wall of blanks.
 */
export function bikeBlockedReason(
  efforts: ActivityEfforts[],
  seasonStart: string,
  weightById: Map<string, number | null> = new Map(),
  book?: BikeBook,
): "no-power" | "no-weight" | null {
  // Only the power books can be blocked this way; outside speed needs neither.
  if (book === "outside") return null;
  const rides = efforts.filter(
    (e) => e.sport === "bike" && e.occurredOn >= seasonStart && inBook(e, book),
  );
  if (rides.length === 0) return null;
  const withPower = rides.filter((e) => Object.keys(e.bests).some((k) => k.startsWith("bike:")));
  if (withPower.length === 0) return "no-power";
  // Same resolution the records use, or the explanation would contradict the book.
  const weighed = withPower.filter(
    (e) => (e.weightKg ?? weightById.get(e.athleteId) ?? 0) > 0,
  );
  if (weighed.length === 0) return "no-weight";
  return null;
}
