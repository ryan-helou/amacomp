import type { Activity, Athlete, Settings } from "./types";
import { seasonByNumber, seasonFor, type SeasonInfo } from "./season";
import { daysBetween, type DayKey } from "./dates";

/**
 * Whether a man is still waiting for his first season, and which one.
 *
 * Ryan, 2026-10-03: George installed the app two days before Season 2 opened,
 * and the only thing to show him was a Season 1 board he was never in, on its
 * second-to-last day, last by fifteen hundred points. So he gets a coming-soon
 * screen and nothing else until the season turns over.
 *
 * ONE PREDICATE, used by the screen AND by the till that would let him log a
 * session. That is not tidiness: the screen hides itself the moment he has an
 * activity, so a logged session would quietly drop him onto the very board the
 * screen exists to keep him off — and he could log one from the API with the
 * screen still up. The server has to refuse the same man the UI is holding.
 *
 * The hold only applies in the LAST WEEK of a season, which is the case it was
 * written for: joining a season with days left on it is joining the next one.
 * Without that bound the first version held him forever — the day Season 2
 * opened he had still logged nothing, so he was held again for Season 3, which
 * is how a welcome screen becomes a locked door. Its own test caught it.
 *
 * A man who turns up mid-season gets the board like everyone else. He can
 * still score; there is nothing to protect him from.
 */

/** How near the end a season has to be for a newcomer to be waiting for the next. */
const JOINING_LATE_DAYS = 6;
export function waitingFor(
  me: Athlete | null,
  activities: Activity[],
  settings: Settings,
  today: DayKey,
): SeasonInfo | null {
  if (!me) return null;
  const cur = seasonFor(today, settings.seasonStart);
  if (!cur) return null;
  // Only in the run-out of a season. Any earlier and he simply joins this one.
  const left = daysBetween(today, cur.end);
  if (left < 0 || left > JOINING_LATE_DAYS) return null;
  // A man who has trained is not waiting for anything.
  if (activities.some((a) => a.athleteId === me.id)) return null;
  const next = seasonByNumber(cur.number + 1, settings.seasonStart);
  if (today >= next.start) return null;
  return next;
}

/**
 * A man's first day in the league: the day he joined, or — if he joined in a
 * season's last week, when the waiting room holds him — the day the next
 * season opens.
 *
 * Ryan, 2026-10-06. George and Jamal connected Strava on Season 2's opening
 * day and the connect-time backfill pulled in two weeks of history: eleven
 * sessions from Season 1, which they were never in. It put them on the
 * Season 1 table, made Jamal host its potluck, paid them coins Ryan had said
 * they would not have, and had last week's card tell the league they owed a
 * marathon. Ryan had the sessions deleted; this is what stops the next man
 * being backfilled the same way. The importer drops anything dated before it.
 */
export function firstDayIn(joinedOn: DayKey, seasonStart: DayKey): DayKey {
  const cur = seasonFor(joinedOn, seasonStart);
  if (!cur || joinedOn < cur.start) return joinedOn;
  const left = daysBetween(joinedOn, cur.end);
  if (left >= 0 && left <= JOINING_LATE_DAYS) {
    return seasonByNumber(cur.number + 1, seasonStart).start;
  }
  return joinedOn;
}
