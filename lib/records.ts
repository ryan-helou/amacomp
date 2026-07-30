import type { Activity, Settings, Sport } from "./types";
import { activityPoints, unscoredGymIds } from "./scoring";
import { formatDay, formatRange, weekEnd, weekStart } from "./dates";
import type { GlyphName } from "@/components/Glyph";

/**
 * The Hall of Fame — all-time records, derived live from the activity log (no
 * storage). Each record is the single best mark anyone has ever posted; beating
 * one puts your name up. Points respect the gym-per-day cap so a record can't be
 * farmed, exactly like the board.
 */
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
  unit: "pts" | "km";
  /** When it was set — a day, or a week range. */
  detail: string;
}

interface Peak {
  holderId: string | null;
  value: number;
  detail: string;
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

  for (const a of activities) {
    const p = pts(a);
    if (p > bigDaySession.value) {
      bigDaySession = { holderId: a.athleteId, value: p, detail: formatDay(a.occurredOn) };
    }
    if (a.sport === "run" && a.km > longestRun.value) {
      longestRun = { holderId: a.athleteId, value: a.km, detail: formatDay(a.occurredOn) };
    }
    if (a.sport === "bike" && a.km > longestRide.value) {
      longestRide = { holderId: a.athleteId, value: a.km, detail: formatDay(a.occurredOn) };
    }
    if (a.sport === "swim" && a.km > longestSwim.value) {
      longestSwim = { holderId: a.athleteId, value: a.km, detail: formatDay(a.occurredOn) };
    }

    const dk = `${a.athleteId}|${a.occurredOn}`;
    dayPts.set(dk, (dayPts.get(dk) ?? 0) + p);
    const wk = weekStart(a.occurredOn);
    const wkk = `${a.athleteId}|${wk}`;
    weekPts.set(wkk, (weekPts.get(wkk) ?? 0) + p);
  }

  let bestDay = emptyPeak();
  for (const [k, v] of dayPts) {
    if (v > bestDay.value) {
      const [holderId, day] = k.split("|");
      bestDay = { holderId, value: v, detail: formatDay(day) };
    }
  }
  let bestWeek = emptyPeak();
  for (const [k, v] of weekPts) {
    if (v > bestWeek.value) {
      const [holderId, wk] = k.split("|");
      bestWeek = { holderId, value: v, detail: formatRange([wk, weekEnd(wk)]) };
    }
  }

  return [
    { key: "week", label: "Biggest week", glyph: "trophy", unit: "pts", ...bestWeek },
    { key: "day", label: "Most points in a day", glyph: "bolt", unit: "pts", ...bestDay },
    { key: "session", label: "Biggest single session", glyph: "flame", unit: "pts", ...bigDaySession },
    { key: "run", label: "Longest run", sport: "run", unit: "km", ...longestRun },
    { key: "ride", label: "Longest ride", sport: "bike", unit: "km", ...longestRide },
    { key: "swim", label: "Longest swim", sport: "swim", unit: "km", ...longestSwim },
  ];
}
