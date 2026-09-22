import type { Activity, Athlete, Settings, Sport } from "./types";
import { SPORT_UNIT, isGrant } from "./types";
import { activityPoints, goalFor, standingsForRange, unscoredGymIds } from "./scoring";
import { addDays, today, weekEnd, weekStart, type DayKey } from "./dates";

export interface TrendWeek {
  weekKey: DayKey;
  label: string;
  points: number;
  hit: boolean;
}

/** The athlete's points for each of the last `weeks` weeks (oldest → newest). */
export function weeklyTrend(
  athleteId: string,
  activities: Activity[],
  settings: Settings,
  refDay: DayKey = today(),
  weeks = 8,
  /** Their name, so a personal weekly goal applies (see `goalFor`). */
  name?: string | null,
): TrendWeek[] {
  const keys: DayKey[] = [];
  let wk = weekStart(refDay);
  for (let i = 0; i < weeks; i++) {
    keys.unshift(wk);
    wk = addDays(wk, -7);
  }
  const unscored = unscoredGymIds(activities);
  return keys.map((w) => {
    const end = weekEnd(w);
    let points = 0;
    for (const a of activities) {
      if (a.athleteId === athleteId && a.occurredOn >= w && a.occurredOn <= end) {
        points += activityPoints(a, settings, unscored);
      }
    }
    const [, m, d] = w.split("-");
    return {
      weekKey: w,
      label: `${Number(d)}/${Number(m)}`,
      points,
      hit: goalFor(name, settings, w) > 0 && points >= goalFor(name, settings, w),
    };
  });
}

export interface TeamTotals {
  points: number;
  sessions: number;
  athletes: number;
  kmBySport: Record<Sport, number>;
  gymWorkouts: number;
  distanceKm: number;
}

/** Everyone's numbers added together — the "look what we've done" card. */
export function teamTotals(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
): TeamTotals {
  const kmBySport: Record<Sport, number> = { swim: 0, bike: 0, run: 0, gym: 0 };
  let points = 0;
  let sessions = 0;
  let gymWorkouts = 0;
  let distanceKm = 0;

  const unscored = unscoredGymIds(activities);
  for (const a of activities) {
    // Admin grants are awarded points, not collective effort — leave them out of
    // the "look what we've done" totals entirely.
    if (isGrant(a)) continue;
    points += activityPoints(a, settings, unscored);
    sessions += 1;
    kmBySport[a.sport] += a.km;
    if (a.sport === "gym") gymWorkouts += 1;
    if (SPORT_UNIT[a.sport] === "km") distanceKm += a.km;
  }

  return {
    points,
    sessions,
    athletes: athletes.length,
    kmBySport,
    gymWorkouts,
    distanceKm,
  };
}

/** An athlete's all-time points split by discipline (for the mix bar). */
export function disciplineMix(
  athleteId: string,
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
) {
  const row = standingsForRange(athletes, activities, settings, [
    "0000-01-01",
    "9999-12-31",
  ]).find((s) => s.athlete.id === athleteId);
  return row ?? null;
}
