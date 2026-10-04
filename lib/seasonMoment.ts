import { addDays, daysBetween, type DayKey } from "./dates";
import { seasonByNumber, seasonFor, type SeasonInfo } from "./season";
import { SOON_DAYS } from "./seasonClose";

/**
 * The in-app announcement a season is due, if any, on `day`.
 *
 *   final-stretch — the last few days before a season closes
 *   last-day      — the day it closes
 *   champion      — the opening week of the next season, crowning the last one
 *
 * Each is shown once per athlete per season (the caller keeps the marker). The
 * windows are ranges rather than single days so that someone who doesn't open
 * the app on the exact morning still sees it the next time they do.
 */
export type SeasonMoment =
  | { kind: "final-stretch"; season: SeasonInfo; daysLeft: number }
  | { kind: "last-day"; season: SeasonInfo }
  | { kind: "champion"; season: SeasonInfo };

export function seasonMomentFor(day: DayKey, seasonStart: DayKey): SeasonMoment | null {
  const cur = seasonFor(day, seasonStart);
  if (!cur || day < cur.start) return null;

  if (cur.number > 1 && day <= addDays(cur.start, 6)) {
    return { kind: "champion", season: seasonByNumber(cur.number - 1, seasonStart) };
  }
  const daysLeft = daysBetween(day, cur.end);
  if (daysLeft === 0) return { kind: "last-day", season: cur };
  if (daysLeft >= 1 && daysLeft <= SOON_DAYS) return { kind: "final-stretch", season: cur, daysLeft };
  return null;
}
