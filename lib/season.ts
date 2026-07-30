import type { Activity, Settings } from "./types";
import { parseDayKey, today, type DayKey } from "./dates";

/** Only sessions on/after the season start count toward the competition. */
export function seasonActivities(
  activities: Activity[],
  settings: Settings,
): Activity[] {
  return activities.filter((a) => a.occurredOn >= settings.seasonStart);
}

export function isPreSeason(settings: Settings, ref: DayKey = today()): boolean {
  return ref < settings.seasonStart;
}

/** Whole days from `ref` until the season starts (0 once it's begun). */
export function daysUntilSeason(settings: Settings, ref: DayKey = today()): number {
  const from = parseDayKey(ref).getTime();
  const to = parseDayKey(settings.seasonStart).getTime();
  return Math.max(0, Math.round((to - from) / 86_400_000));
}
