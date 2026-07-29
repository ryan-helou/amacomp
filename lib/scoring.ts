import type { Activity, Athlete, Settings, Sport } from "./types";
import { SPORTS } from "./types";
import { inRange, type DayKey, type Period, periodRange } from "./dates";

/**
 * Points are derived from distance at read time rather than frozen when an
 * activity is logged. The multipliers are the rules of the competition, so when
 * Ryan changes them the whole season re-scores — nobody keeps points that were
 * earned under a rule that no longer exists.
 */
export function pointsFor(km: number, sport: Sport, settings: Settings): number {
  return km * (settings.multipliers[sport] ?? 0);
}

export function activityPoints(a: Activity, settings: Settings): number {
  return pointsFor(a.km, a.sport, settings);
}

export interface Standing {
  athlete: Athlete;
  points: number;
  km: number;
  sessions: number;
  /** Points contributed by each sport, for the split bars. */
  bySport: Record<Sport, number>;
  kmBySport: Record<Sport, number>;
  rank: number;
  /** Fraction of the weekly goal reached — only meaningful for the week view. */
  goalProgress: number;
}

function emptySportMap(): Record<Sport, number> {
  return { swim: 0, bike: 0, run: 0 };
}

export function standingsFor(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  period: Period,
  ref?: DayKey,
): Standing[] {
  const range = periodRange(period, ref);
  const rows = new Map<string, Standing>();

  for (const athlete of athletes) {
    rows.set(athlete.id, {
      athlete,
      points: 0,
      km: 0,
      sessions: 0,
      bySport: emptySportMap(),
      kmBySport: emptySportMap(),
      rank: 0,
      goalProgress: 0,
    });
  }

  for (const a of activities) {
    if (!inRange(a.occurredOn, range)) continue;
    const row = rows.get(a.athleteId);
    if (!row) continue;
    const pts = activityPoints(a, settings);
    row.points += pts;
    row.km += a.km;
    row.sessions += 1;
    row.bySport[a.sport] += pts;
    row.kmBySport[a.sport] += a.km;
  }

  const list = [...rows.values()].sort(
    (x, y) => y.points - x.points || x.athlete.name.localeCompare(y.athlete.name),
  );

  // Equal totals share a lane number; the next athlete drops by the tie count.
  let rank = 0;
  let seen = 0;
  let prev: number | null = null;
  for (const row of list) {
    seen += 1;
    if (prev === null || Math.abs(row.points - prev) > 1e-9) {
      rank = seen;
      prev = row.points;
    }
    row.rank = rank;
    row.goalProgress =
      settings.weeklyGoal > 0 ? row.points / settings.weeklyGoal : 0;
  }

  return list;
}

export function totalPoints(activities: Activity[], settings: Settings): number {
  return activities.reduce((sum, a) => sum + activityPoints(a, settings), 0);
}

/** Trim float noise, keep one decimal, and never render "12.0". */
export function fmtPoints(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function fmtKm(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export const SPORT_ORDER = SPORTS;
