import { seasonFor } from "./season";
import type { DayKey } from "./dates";

/**
 * Athletes who have stopped playing, and the season they're out from.
 *
 * Ryan, 2026-11-16: "jonah is no longer playing with us", then "keep him but
 * make him grayed on leaderboards for s2 (keep him in s1), and also ofc for the
 * main week list make him greyed". So he stays on every list, scored as
 * before, just drawn greyed in any window that reaches into that season.
 *
 * Keyed by EXACT name, like TRIPS in lib/away — Jona and Jonah are two people.
 */
export const LEFT_FROM_SEASON: Record<string, number> = { Jonah: 2 };

/** Whether to grey this athlete in a window ending on `rangeEnd`. */
export function isLeftIn(name: string, rangeEnd: DayKey, seasonStart: DayKey): boolean {
  const from = LEFT_FROM_SEASON[name];
  if (from === undefined) return false;
  const season = seasonFor(rangeEnd, seasonStart);
  return season !== null && season.number >= from;
}

/** The classes that grey a row out. */
export const LEFT_ROW = "opacity-40 grayscale";
