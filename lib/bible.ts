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

/**
 * The past days an athlete lost points to the box, newest first, with what the
 * day would score once ticked. Today is left out: it has its own box on the
 * Week tab.
 *
 * Ryan, 2026-11-13: a section in Settings "with the list of days you lost
 * points cuz u didnt read the bible and u can check it off urself". So any past
 * day since BIBLE_FROM can be ticked after the fact, by the athlete, for
 * himself only — and only a day that actually has a session waiting on it.
 */
export function missedBibleDays(
  activities: Activity[],
  athleteId: string,
  today: string,
  pointsOf: (a: Activity) => number,
): { day: string; points: number; sessions: number }[] {
  const byDay = new Map<string, { points: number; sessions: number }>();
  for (const a of activities) {
    if (a.athleteId !== athleteId || !a.bibleMissing || a.occurredOn >= today) continue;
    const row = byDay.get(a.occurredOn) ?? { points: 0, sessions: 0 };
    row.points += pointsOf({ ...a, bibleMissing: false });
    row.sessions += 1;
    byDay.set(a.occurredOn, row);
  }
  return [...byDay.entries()]
    .map(([day, r]) => ({ day, ...r }))
    // Only days that actually cost points. A day whose sessions would still
    // score 0 ticked (a gym session with no sets) lost nothing to the box.
    .filter((d) => d.points > 0)
    .sort((x, y) => y.day.localeCompare(x.day));
}

/**
 * Which day a tick of the box lands on, given the day the phone asked for and
 * the league's own day (Toronto). A phone abroad is up to a day either side of
 * Toronto — Ryan in China at 9 AM on the 15th is still the evening of the 14th
 * in Toronto — and its sessions are dated by the phone, so "today" is the
 * phone's day whenever it is within a day of the league's. Anything older is a
 * past day ticked from Settings; anything else is refused.
 */
export function bibleTickKind(requested: string, leagueDay: string): "today" | "past" | null {
  const diff = Math.round(
    (Date.parse(`${requested}T00:00:00Z`) - Date.parse(`${leagueDay}T00:00:00Z`)) / 86_400_000,
  );
  if (!Number.isFinite(diff)) return null;
  if (Math.abs(diff) <= 1) return "today";
  return diff < 0 ? "past" : null;
}
