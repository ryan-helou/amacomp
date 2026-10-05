import type { Activity, Settings } from "./types";
import { isGrant } from "./types";
import { activityPoints, unscoredGymIds } from "./scoring";
import { addDays, weekStart, weekEnd, type DayKey } from "./dates";

/**
 * Bounties the board awards itself.
 *
 * Ryan, 2026-10-05: "for bounties it should be automatic given to someone."
 * This reverses the original design note in lib/bounties.ts, which had every
 * bounty settled by hand on the grounds that a bounty should be free to ask
 * for things the board cannot see. That is still true of a bounty with no
 * rule — "drag Jonah out on a Sunday" has no checker and never will. What
 * changed is that the six bounties actually posted are all things the board
 * CAN see, and making Ryan the clerk for those is a chore, not a safeguard.
 *
 * So a bounty may carry a rule. If it does, nobody claims it and nobody
 * confirms it: the winner is DERIVED from the same activities the Board is
 * drawn from, exactly like a bet. That means a session struck off a fortnight
 * later takes the bounty back with it, and a bounty cannot be paid twice,
 * because there is no payment — only a question with one answer.
 *
 * A rule only ever looks at days from the day the bounty was posted onward.
 * A bounty you win with last month's training is a prize for having already
 * done it, which is not what a bounty is.
 */

export type BountyRule =
  /** A session of this sport every day for N days running. "any" = anything at all. */
  | { kind: "streak"; sport: "any" | "run" | "bike" | "swim" | "gym"; days: number }
  /** N or more points between one midnight and the next. */
  | { kind: "pointsInDay"; points: number }
  /** N or more different sports in the same day. */
  | { kind: "sportsInDay"; sports: number }
  /** N or more hours of moving time in a single Monday-to-Sunday week. */
  | { kind: "hoursInWeek"; hours: number };

export interface BountyWin {
  athleteId: string;
  /** The day the rule came true — what makes "first" mean something. */
  day: DayKey;
}

/** The scoring sessions one athlete logged, by day, from `from` onward. */
function byDay(
  athleteId: string,
  activities: Activity[],
  from: DayKey,
): Map<DayKey, Activity[]> {
  const out = new Map<DayKey, Activity[]>();
  for (const a of activities) {
    if (a.athleteId !== athleteId) continue;
    if (a.occurredOn < from) continue;
    const day = a.occurredOn as DayKey;
    const list = out.get(day);
    if (list) list.push(a);
    else out.set(day, [a]);
  }
  return out;
}

/**
 * The first day this athlete satisfied the rule, or null.
 *
 * Every branch walks days in order and returns the EARLIEST qualifying day,
 * because the bounty goes to whoever got there first and "first" is decided
 * by the day, not by who the loop happened to reach first.
 */
export function ruleMetOn(
  rule: BountyRule,
  athleteId: string,
  activities: Activity[],
  settings: Settings,
  from: DayKey,
  until: DayKey,
): DayKey | null {
  const days = byDay(athleteId, activities, from);
  if (!days.size) return null;
  const unscored = unscoredGymIds(activities);
  const sorted = [...days.keys()].filter((d) => d <= until).sort();
  if (!sorted.length) return null;

  const pointsOn = (day: DayKey) =>
    (days.get(day) ?? []).reduce(
      (sum, a) =>
        sum + (unscored.has(a.id) ? 0 : isGrant(a) ? (a.points ?? 0) : activityPoints(a, settings)),
      0,
    );

  switch (rule.kind) {
    case "streak": {
      // A streak needs consecutive calendar days, so walk the days themselves
      // rather than the list — a gap is the absence of an entry.
      const has = (day: DayKey) => {
        const list = days.get(day);
        if (!list) return false;
        return rule.sport === "any"
          ? list.some((a) => !isGrant(a))
          : list.some((a) => !isGrant(a) && a.sport === rule.sport);
      };
      let run = 0;
      for (let d = sorted[0]; d <= until; d = addDays(d, 1)) {
        run = has(d) ? run + 1 : 0;
        if (run >= rule.days) return d;
      }
      return null;
    }
    case "pointsInDay": {
      for (const d of sorted) if (pointsOn(d) >= rule.points) return d;
      return null;
    }
    case "sportsInDay": {
      for (const d of sorted) {
        const kinds = new Set(
          (days.get(d) ?? []).filter((a) => !isGrant(a) && !unscored.has(a.id)).map((a) => a.sport),
        );
        if (kinds.size >= rule.sports) return d;
      }
      return null;
    }
    case "hoursInWeek": {
      // Only sessions that actually carry a time can count. A hand-logged
      // session has no movingSeconds, so it contributes nothing — said out
      // loud in the bounty's own detail line rather than hidden here.
      const need = rule.hours * 3600;
      const weeks = new Set(sorted.map((d) => weekStart(d)));
      for (const wk of [...weeks].sort()) {
        const end = weekEnd(wk);
        let secs = 0;
        for (let d = wk; d <= end && d <= until; d = addDays(d, 1))
          for (const a of days.get(d) ?? []) secs += a.movingSeconds ?? 0;
        // It is won the day the week closes, not mid-week: a week is only a
        // week once it has finished, and a part-week total is not a result.
        if (secs >= need && end <= until) return end;
      }
      return null;
    }
  }
}

/**
 * Who won this bounty, across the whole league — the earliest qualifying day
 * wins, and a tie on the same day goes to nobody until one of them logs
 * something more. A tie is rare enough, and silently picking one of two men
 * is worse than leaving it open for a day.
 */
export function bountyWinner(
  rule: BountyRule,
  athleteIds: string[],
  activities: Activity[],
  settings: Settings,
  from: DayKey,
  until: DayKey,
): BountyWin | null {
  const wins: BountyWin[] = [];
  for (const athleteId of athleteIds) {
    const day = ruleMetOn(rule, athleteId, activities, settings, from, until);
    if (day) wins.push({ athleteId, day });
  }
  if (!wins.length) return null;
  wins.sort((a, b) => a.day.localeCompare(b.day));
  if (wins.length > 1 && wins[0].day === wins[1].day) return null;
  return wins[0];
}

/** A rule in the words the board would use. Shown under the bounty's title. */
export function ruleLabel(rule: BountyRule): string {
  switch (rule.kind) {
    case "streak":
      return rule.sport === "any"
        ? `Log something ${rule.days} days running`
        : `${rule.sport === "bike" ? "Ride" : rule.sport === "run" ? "Run" : rule.sport === "swim" ? "Swim" : "Train"} ${rule.days} days running`;
    case "pointsInDay":
      return `${rule.points} points in one day`;
    case "sportsInDay":
      return `${rule.sports} different sports in one day`;
    case "hoursInWeek":
      return `${rule.hours} hours of moving time in one week`;
  }
}

/** Parse a stored rule. Anything unrecognised is no rule at all, not a crash. */
export function parseRule(raw: unknown): BountyRule | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && v > 0 && Number.isFinite(v) ? v : null);
  switch (r.kind) {
    case "streak": {
      const days = n(r.days);
      const sport = r.sport;
      const ok = sport === "any" || sport === "run" || sport === "bike" || sport === "swim" || sport === "gym";
      return days && ok ? { kind: "streak", sport, days } : null;
    }
    case "pointsInDay": {
      const points = n(r.points);
      return points ? { kind: "pointsInDay", points } : null;
    }
    case "sportsInDay": {
      const sports = n(r.sports);
      return sports ? { kind: "sportsInDay", sports } : null;
    }
    case "hoursInWeek": {
      const hours = n(r.hours);
      return hours ? { kind: "hoursInWeek", hours } : null;
    }
    default:
      return null;
  }
}
