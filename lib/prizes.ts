import type { Activity, Athlete, Settings } from "./types";
import type { DayKey } from "./dates";
import { reigningPodium } from "./season";
import { coinAccount } from "./coins";

/**
 * The trophies a man has actually earned, and so may wear.
 *
 * Ryan, 2026-10-06: "I can't get the second place thing if I finished first"
 * — and the night before, "no one should have any items, only a black shirt
 * and black shorts and whatever 1st, 2nd, 3rd place trophies you earned."
 *
 * Trophies cost nothing, and the save rule used to be "free kit is
 * everyone's", so anybody could put on anybody's crown. A trophy isn't free
 * kit; it's a result. This is the one place that says whose result it is, and
 * both the shop and the server ask it.
 *
 *   crown / silver / bronze — 1st, 2nd and 3rd of the last FINISHED season,
 *                             worn through the season after it
 *   medal                   — has won a week, ever
 *   sash                    — has won a month, ever
 *
 * All derived, like every coin in the app: a rescored season moves the
 * circlets with it.
 */
export function earnedPrizes(
  athleteId: string,
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  refDay: DayKey,
): Set<string> {
  const out = new Set<string>(["prize.none"]);
  const podium = reigningPodium(athletes, activities, settings, refDay);
  if (podium[0] === athleteId) out.add("prize.crown");
  if (podium[1] === athleteId) out.add("prize.silver");
  if (podium[2] === athleteId) out.add("prize.bronze");
  // Week and month wins are already worked out by the coin ledger — they pay
  // 50 and 100 coins — so read them from there rather than a second copy.
  const won = coinAccount(athleteId, athletes, activities, settings, refDay).entries;
  if (won.some((e) => e.kind === "week")) out.add("prize.medal");
  if (won.some((e) => e.kind === "month")) out.add("prize.sash");
  return out;
}
