import type { Activity } from "./types";
import { isGrant } from "./types";

/**
 * The Bible rule.
 *
 * Ryan, 2026-11-02: "in order for points to count for your activity today, you
 * have to check a box that you read the bible today."
 *
 * So a session scores only if its athlete ticked the box for the session's own
 * day. It is a gate, not a bonus: the box is worth nothing on its own, and an
 * unticked day scores zero however far you went. Tick it later the same day and
 * the day's sessions count again — it is derived at read time like every other
 * number here, so nothing has to be rescored.
 *
 * It starts on BIBLE_FROM and never reaches back: every session before it
 * keeps the points it had ("dont change the past"). Grants are not sessions and
 * are never gated.
 */
export const BIBLE_FROM = "2026-11-03";

export interface BibleDay {
  athleteId: string;
  day: string;
}

/** Does this day need the box at all? */
export function bibleApplies(day: string): boolean {
  return day >= BIBLE_FROM;
}

export function hasRead(days: BibleDay[], athleteId: string, day: string): boolean {
  return days.some((b) => b.athleteId === athleteId && b.day === day);
}

/**
 * Stamp every gated session whose day was not ticked. Done in the store, as the
 * activities are read, so every path that scores — the app, the coin checks in
 * the club and arena routes, the pushes — sees the same answer.
 */
export function markBible(activities: Activity[], days: BibleDay[]): Activity[] {
  const read = new Set(days.map((b) => `${b.athleteId}|${b.day}`));
  return activities.map((a) =>
    !isGrant(a) && bibleApplies(a.occurredOn) && !read.has(`${a.athleteId}|${a.occurredOn}`)
      ? { ...a, bibleMissing: true }
      : a,
  );
}
