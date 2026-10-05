import { addDays, type DayKey } from "./dates";
import { seasonByNumber, seasonFor, type SeasonInfo } from "./season";

/**
 * The in-app announcement a season is due, if any, on `day`.
 *
 *   champion      — the opening week of the next season, crowning the last one
 *
 * There used to be a run-in as well — a countdown card for the last few days,
 * a "THE TABLE LOCKS" card on the last one, a run-in panel on the Board and
 * push notifications to match. Ryan removed all of it on 2026-10-06.
 *
 * Each is shown once per athlete per season (the caller keeps the marker). The
 * windows are ranges rather than single days so that someone who doesn't open
 * the app on the exact morning still sees it the next time they do.
 */
export type SeasonMoment = { kind: "champion"; season: SeasonInfo };

export function seasonMomentFor(day: DayKey, seasonStart: DayKey): SeasonMoment | null {
  const cur = seasonFor(day, seasonStart);
  if (!cur || day < cur.start) return null;

  if (cur.number > 1 && day <= addDays(cur.start, 6)) {
    return { kind: "champion", season: seasonByNumber(cur.number - 1, seasonStart) };
  }
  return null;
}
