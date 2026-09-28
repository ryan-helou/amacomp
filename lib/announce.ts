import { SPORTS, type Settings, type Sport } from "./types";
import { addDays, type DayKey } from "./dates";
import { ratesOn } from "./scoring";

/**
 * Working out whether a scoring change is worth announcing, and what it actually
 * changed.
 *
 * Derived from `settings.rateChanges` rather than hard-coded, so every future
 * rate change announces itself with no new code — the same way the scoring sheet
 * already lists the ones that are scheduled.
 */

/** The hour a change is announced on the day it starts. Sessions logged before
 *  a rollover window still count for yesterday at yesterday's rates, so telling
 *  someone at 1 AM that the rates have moved would be telling them a lie about
 *  the run they are logging. 6 AM is comfortably clear of that. */
export const ANNOUNCE_HOUR = 6;

/** How long a change stays announceable. Someone opening the app for the first
 *  time in a month should be told the rules moved; someone opening it in March
 *  should not be shown August's news. */
const ANNOUNCE_WINDOW_DAYS = 7;

export interface RateMove {
  sport: Sport;
  /** Points per km / per workout, before and after. Equal values are filtered out. */
  before: number;
  after: number;
  /** True when this is the climbing rate rather than the distance rate. */
  climb: boolean;
}

export interface RateAnnouncement {
  /** The day the change took effect — also the localStorage key, so each change
   *  is shown once and only once per athlete per device. */
  from: DayKey;
  moves: RateMove[];
}

/**
 * The rate change to announce on `day`, or null.
 *
 * Takes the most recent change that has actually started, and diffs the rates
 * either side of it so the card can say "5 → 4" rather than just "4". Comparing
 * against the day before means a change that only restates an existing rate
 * produces no moves, and so no announcement.
 */
export function rateAnnouncementFor(
  day: DayKey,
  settings: Settings,
): RateAnnouncement | null {
  const started = (settings.rateChanges ?? []).filter((c) => c.from <= day);
  const latest = started[started.length - 1];
  if (!latest) return null;
  if (day > addDays(latest.from, ANNOUNCE_WINDOW_DAYS)) return null;

  const before = ratesOn(addDays(latest.from, -1), settings);
  const after = ratesOn(latest.from, settings);
  const moves: RateMove[] = [];
  for (const sport of SPORTS) {
    if (before.multipliers[sport] !== after.multipliers[sport]) {
      moves.push({
        sport,
        before: before.multipliers[sport],
        after: after.multipliers[sport],
        climb: false,
      });
    }
    if (before.elevationPer100m[sport] !== after.elevationPer100m[sport]) {
      moves.push({
        sport,
        before: before.elevationPer100m[sport],
        after: after.elevationPer100m[sport],
        climb: true,
      });
    }
  }
  if (moves.length === 0) return null;
  return { from: latest.from, moves };
}

/**
 * Whether the change may be shown yet.
 *
 * On the day it starts it waits for `ANNOUNCE_HOUR`; after that it can show at
 * any hour, so someone who was away doesn't miss it. `hour` is the viewer's own
 * clock — this is a per-device moment, not a server one.
 */
export function announcementIsDue(
  announcement: RateAnnouncement,
  day: DayKey,
  hour: number,
): boolean {
  if (day < announcement.from) return false;
  if (day > announcement.from) return true;
  return hour >= ANNOUNCE_HOUR;
}
