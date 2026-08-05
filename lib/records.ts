import type { Activity, Settings, Sport } from "./types";
import { SPORT_UNIT, isGrant } from "./types";
import { activityPoints, unscoredGymIds } from "./scoring";
import { addDays, formatDay, formatRange, weekEnd, weekStart, type DayKey } from "./dates";
import type { GlyphName } from "@/components/Glyph";

/**
 * The Hall of Fame — all-time records, derived live from the activity log (no
 * storage). Each record is the single best mark anyone has ever posted; beating
 * one puts your name up. Points respect the gym-per-day cap so a record can't be
 * farmed, exactly like the board.
 */
/** Enough to reconstruct the story of the record — the record sheet uses this
 *  to filter the full activity list back down to the sessions that built it. */
export type RecordContext =
  | { kind: "day"; day: DayKey }
  | { kind: "week"; weekStart: DayKey }
  | { kind: "activity"; activityId: string }
  | { kind: "streak"; endDay: DayKey; length: number };

export interface HallRecord {
  key: string;
  label: string;
  /** A monochrome glyph for the abstract records… */
  glyph?: GlyphName;
  /** …or a discipline, for the distance records. */
  sport?: Sport;
  /** Athlete id who holds it, or null if nobody's posted a mark yet. */
  holderId: string | null;
  value: number;
  unit: "pts" | "km" | "days" | "sessions";
  /** When it was set — a day, or a week range. */
  detail: string;
  /** How to re-derive the sessions behind this mark. Absent while unclaimed. */
  context?: RecordContext;
}

interface Peak {
  holderId: string | null;
  value: number;
  detail: string;
  context?: RecordContext;
}
const emptyPeak = (): Peak => ({ holderId: null, value: 0, detail: "" });

export function hallOfFame(activities: Activity[], settings: Settings): HallRecord[] {
  const unscored = unscoredGymIds(activities);
  const pts = (a: Activity) => activityPoints(a, settings, unscored);

  let bigDaySession = emptyPeak(); // most points from one logged session
  let longestRun = emptyPeak();
  let longestRide = emptyPeak();
  let longestSwim = emptyPeak();

  const dayPts = new Map<string, number>(); // `athleteId|day` → points
  const weekPts = new Map<string, number>(); // `athleteId|weekStart` → points
  const dayKm = new Map<string, number>(); // `athleteId|day` → distance km
  const weekSessions = new Map<string, number>(); // `athleteId|weekStart` → session count
  const athleteDays = new Map<string, Set<string>>(); // athleteId → set of active days

  for (const a of activities) {
    // Awarded points aren't a performance — they never set a record.
    if (isGrant(a)) continue;
    const p = pts(a);
    if (p > bigDaySession.value) {
      bigDaySession = {
        holderId: a.athleteId,
        value: p,
        detail: formatDay(a.occurredOn),
        context: { kind: "activity", activityId: a.id },
      };
    }
    if (a.sport === "run" && a.km > longestRun.value) {
      longestRun = {
        holderId: a.athleteId,
        value: a.km,
        detail: formatDay(a.occurredOn),
        context: { kind: "activity", activityId: a.id },
      };
    }
    if (a.sport === "bike" && a.km > longestRide.value) {
      longestRide = {
        holderId: a.athleteId,
        value: a.km,
        detail: formatDay(a.occurredOn),
        context: { kind: "activity", activityId: a.id },
      };
    }
    if (a.sport === "swim" && a.km > longestSwim.value) {
      longestSwim = {
        holderId: a.athleteId,
        value: a.km,
        detail: formatDay(a.occurredOn),
        context: { kind: "activity", activityId: a.id },
      };
    }

    const dk = `${a.athleteId}|${a.occurredOn}`;
    dayPts.set(dk, (dayPts.get(dk) ?? 0) + p);
    const wk = weekStart(a.occurredOn);
    const wkk = `${a.athleteId}|${wk}`;
    weekPts.set(wkk, (weekPts.get(wkk) ?? 0) + p);
    // Distance only — a flat gym "1 km" shouldn't count toward a km record.
    if (SPORT_UNIT[a.sport] === "km") dayKm.set(dk, (dayKm.get(dk) ?? 0) + a.km);
    weekSessions.set(wkk, (weekSessions.get(wkk) ?? 0) + 1);
    let days = athleteDays.get(a.athleteId);
    if (!days) athleteDays.set(a.athleteId, (days = new Set()));
    days.add(a.occurredOn);
  }

  let bestDay = emptyPeak();
  for (const [k, v] of dayPts) {
    if (v > bestDay.value) {
      const [holderId, day] = k.split("|");
      bestDay = { holderId, value: v, detail: formatDay(day), context: { kind: "day", day } };
    }
  }
  let bestWeek = emptyPeak();
  for (const [k, v] of weekPts) {
    if (v > bestWeek.value) {
      const [holderId, wk] = k.split("|");
      bestWeek = {
        holderId,
        value: v,
        detail: formatRange([wk, weekEnd(wk)]),
        context: { kind: "week", weekStart: wk },
      };
    }
  }
  let bestKmDay = emptyPeak();
  for (const [k, v] of dayKm) {
    if (v > bestKmDay.value) {
      const [holderId, day] = k.split("|");
      bestKmDay = { holderId, value: v, detail: formatDay(day), context: { kind: "day", day } };
    }
  }
  let busiestWeek = emptyPeak();
  for (const [k, v] of weekSessions) {
    if (v > busiestWeek.value) {
      const [holderId, wk] = k.split("|");
      busiestWeek = {
        holderId,
        value: v,
        detail: formatRange([wk, weekEnd(wk)]),
        context: { kind: "week", weekStart: wk },
      };
    }
  }
  // Longest run of consecutive days with at least one session.
  let longestStreak = emptyPeak();
  for (const [holderId, daysSet] of athleteDays) {
    const days = [...daysSet].sort();
    let run = 0;
    let best = 0;
    let bestEnd = "";
    for (let i = 0; i < days.length; i++) {
      run = i > 0 && days[i] === addDays(days[i - 1], 1) ? run + 1 : 1;
      if (run > best) {
        best = run;
        bestEnd = days[i];
      }
    }
    if (best > longestStreak.value) {
      longestStreak = {
        holderId,
        value: best,
        detail: `to ${formatDay(bestEnd)}`,
        context: { kind: "streak", endDay: bestEnd, length: best },
      };
    }
  }

  return [
    { key: "week", label: "Biggest week", glyph: "trophy", unit: "pts", ...bestWeek },
    { key: "day", label: "Most points in a day", glyph: "bolt", unit: "pts", ...bestDay },
    { key: "session", label: "Biggest single session", glyph: "star", unit: "pts", ...bigDaySession },
    { key: "kmday", label: "Most km in a day", glyph: "target", unit: "km", ...bestKmDay },
    { key: "busiest", label: "Busiest week", glyph: "trio", unit: "sessions", ...busiestWeek },
    { key: "streak", label: "Longest streak", glyph: "flame", unit: "days", ...longestStreak },
    { key: "run", label: "Longest run", sport: "run", unit: "km", ...longestRun },
    { key: "ride", label: "Longest ride", sport: "bike", unit: "km", ...longestRide },
    { key: "swim", label: "Longest swim", sport: "swim", unit: "km", ...longestSwim },
  ];
}
