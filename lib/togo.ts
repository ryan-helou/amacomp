import { rateFor } from "./scoring";
import { SPORT_UNIT, type Settings, type Sport } from "./types";
import { SPORTS } from "./types";
import { MAX_SCORING_GYM_PER_DAY } from "./validate";
import type { DayKey } from "./dates";

/**
 * What the points you are short actually cost, in each discipline.
 *
 * Forty percent of finished athlete-weeks land between 100 and 110 against a
 * 100-point quota, so the moment that decides a week is almost always "I'm
 * thirty-eight short — what's the cheapest way home?". The app knew the answer
 * and made everyone work it out from a rates footnote.
 *
 * Deliberately CONSERVATIVE, in three places. Swim is quoted at the pool rate,
 * because a swim is scored as a pool swim unless it is known to be open water,
 * and a number that assumes the better rate would send someone home short. Bike
 * and run are quoted flat, ignoring the ascent both of them also earn: climbing
 * can only make the real ride shorter than the quote, never longer. Every
 * distance rounds UP to the tenth, for the same reason.
 */

export interface ToGoOption {
  sport: Sport;
  /** Kilometres, or whole workouts for the flat gym discipline. */
  amount: number;
  unit: "km" | "flat";
  /** Points per kilometre, or per workout. */
  rate: number;
  /**
   * Gym only: the answer needs more workouts than the daily cap allows in the
   * days that are left, so it is arithmetic rather than a plan.
   */
  beyondCap?: boolean;
}

/** Up to the next tenth. Quoting 9.4 km for something that needs 9.47 is a
 *  rounding that costs someone the week. */
function ceilTenth(n: number): number {
  return Math.ceil(n * 10) / 10;
}

/**
 * One option per discipline for closing `shortfall` points, at the rates in
 * force on `day` — the day a session logged now would count for, not the day
 * the board is showing.
 *
 * `daysLeft` is how many days remain to do it in (today included); it only
 * affects whether the gym answer is flagged as impossible. Disciplines that
 * cannot close the gap at all (a zero rate) are dropped rather than shown as
 * infinity.
 */
export function toGo(
  shortfall: number,
  settings: Settings,
  day: DayKey,
  daysLeft: number,
): ToGoOption[] {
  if (shortfall <= 0) return [];
  const out: ToGoOption[] = [];

  for (const sport of SPORTS) {
    // Pool, not open water: the conservative rate. See the note above.
    const rate = rateFor(sport, settings, day, sport === "swim" ? false : null);
    if (rate <= 0) continue;

    if (SPORT_UNIT[sport] === "flat") {
      const sessions = Math.ceil(shortfall / rate);
      const affordable = MAX_SCORING_GYM_PER_DAY * Math.max(0, daysLeft);
      out.push({
        sport,
        amount: sessions,
        unit: "flat",
        rate,
        beyondCap: sessions > affordable,
      });
    } else {
      out.push({ sport, amount: ceilTenth(shortfall / rate), unit: "km", rate });
    }
  }

  return out;
}
