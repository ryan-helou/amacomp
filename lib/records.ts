import type { Activity, Settings, Sport } from "./types";
import { SPORT_UNIT, isGrant } from "./types";
import { activityPoints, unscoredGymIds } from "./scoring";
import {
  addDays,
  formatDay,
  formatMonth,
  formatRange,
  monthStart,
  weekEnd,
  weekStart,
  type DayKey,
} from "./dates";
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
  | { kind: "month"; month: DayKey }
  | { kind: "range"; from: DayKey; to: DayKey }
  | { kind: "activity"; activityId: string }
  | { kind: "streak"; endDay: DayKey; length: number };

/** One athlete's own best mark on a record, for the ranking behind it. */
export interface HallEntry {
  athleteId: string;
  value: number;
  detail: string;
  context?: RecordContext;
}

/**
 * Which shelf of the trophy case a record sits on. Eighteen records in one
 * column read as noise; grouped by what they actually measure, the case can be
 * skimmed — and the units line up inside a group, which is what made the flat
 * list look ragged.
 */
export type HallGroup = "points" | "distance" | "volume" | "consistency";

export interface HallRecord {
  key: string;
  label: string;
  group: HallGroup;
  /** A monochrome glyph for the abstract records… */
  glyph?: GlyphName;
  /** …or a discipline, for the distance records. */
  sport?: Sport;
  /** Athlete id who holds it, or null if nobody's posted a mark yet. */
  holderId: string | null;
  value: number;
  unit: "pts" | "km" | "days" | "sessions" | "sports" | "weeks" | "time";
  /** When it was set — a day, or a week range. */
  detail: string;
  /** How to re-derive the sessions behind this mark. Absent while unclaimed. */
  context?: RecordContext;
  /**
   * Everyone who has a mark on this record, best first — one entry per athlete,
   * so a prolific week can't fill the list. `entries[0]` is the holder above.
   * Empty while nobody has posted anything.
   */
  entries: HallEntry[];
}

/**
 * Rank a `athleteId|period` map into one best-per-athlete list.
 *
 * `dir` matters: nearly every record here is "more is better", but fastest-to-
 * quota is a race to the fewest days, and ranking it the wrong way round would
 * crown whoever took longest.
 */
function rank(
  map: Map<string, number>,
  detail: (period: string) => string,
  context: (period: string) => RecordContext,
  dir: "higher" | "lower" = "higher",
): HallEntry[] {
  const per = new Map<string, HallEntry>();
  for (const [k, value] of map) {
    if (!Number.isFinite(value) || value <= 0) continue;
    const [athleteId, period] = k.split("|");
    const cur = per.get(athleteId);
    const better = !cur || (dir === "higher" ? value > cur.value : value < cur.value);
    if (better) per.set(athleteId, { athleteId, value, detail: detail(period), context: context(period) });
  }
  return [...per.values()].sort((a, b) =>
    dir === "higher" ? b.value - a.value : a.value - b.value,
  );
}

/** Same, for maps whose value is a set and whose size is the mark. */
function rankSets(
  map: Map<string, Set<string>>,
  detail: (period: string) => string,
  context: (period: string) => RecordContext,
): HallEntry[] {
  const sizes = new Map<string, number>();
  for (const [k, set] of map) sizes.set(k, set.size);
  return rank(sizes, detail, context);
}

/** Sort a per-athlete map that was accumulated directly. */
function rankDirect(per: Map<string, HallEntry>): HallEntry[] {
  return [...per.values()].sort((a, b) => b.value - a.value);
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
  // The league goal, deliberately, not anyone's personal one: these are records
  // held against each other, so the quota streak and the fastest quota have to
  // mean the same feat for everybody.
  const goal = settings.weeklyGoal;

  // Per-athlete bests for the records that come straight off a single session.
  const sessionBy = new Map<string, HallEntry>();
  const runBy = new Map<string, HallEntry>();
  const rideBy = new Map<string, HallEntry>();
  const swimBy = new Map<string, HallEntry>();
  const keepBest = (m: Map<string, HallEntry>, e: HallEntry) => {
    const cur = m.get(e.athleteId);
    if (!cur || e.value > cur.value) m.set(e.athleteId, e);
  };

  let bigDaySession = emptyPeak(); // most points from one logged session
  let longestRun = emptyPeak();
  let longestRide = emptyPeak();
  let longestSwim = emptyPeak();

  const dayPts = new Map<string, number>(); // `athleteId|day` → points
  const weekPts = new Map<string, number>(); // `athleteId|weekStart` → points
  const monthPts = new Map<string, number>(); // `athleteId|monthStart` → points
  const dayKm = new Map<string, number>(); // `athleteId|day` → distance km
  const weekKm = new Map<string, number>(); // `athleteId|weekStart` → distance km
  const monthKm = new Map<string, number>(); // `athleteId|monthStart` → distance km
  // Moving seconds. Strava only — a hand-logged session has no clock on it, so
  // it contributes nothing here rather than counting as zero (see
  // `Activity.movingSeconds`).
  const daySecs = new Map<string, number>(); // `athleteId|day` → moving seconds
  const weekSecs = new Map<string, number>(); // `athleteId|weekStart` → moving seconds
  let longestSession = emptyPeak();
  const longSessionBy = new Map<string, HallEntry>();
  const daySessions = new Map<string, number>(); // `athleteId|day` → session count
  const weekSessions = new Map<string, number>(); // `athleteId|weekStart` → session count
  const weekGym = new Map<string, number>(); // `athleteId|weekStart` → gym workout count
  const monthDays = new Map<string, Set<string>>(); // `athleteId|monthStart` → active days
  const daySports = new Map<string, Set<string>>(); // `athleteId|day` → disciplines that day
  const athleteDays = new Map<string, Set<string>>(); // athleteId → set of active days

  for (const a of activities) {
    // Awarded points aren't a performance — they never set a record.
    if (isGrant(a)) continue;
    const p = pts(a);
    const here = (value: number): HallEntry => ({
      athleteId: a.athleteId, value,
      detail: formatDay(a.occurredOn),
      context: { kind: "activity", activityId: a.id },
    });
    if (p > 0) keepBest(sessionBy, here(p));
    if (a.sport === "run" && a.km > 0) keepBest(runBy, here(a.km));
    if (a.sport === "bike" && a.km > 0) keepBest(rideBy, here(a.km));
    if (a.sport === "swim" && a.km > 0) keepBest(swimBy, here(a.km));
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

    const secs = a.movingSeconds ?? 0;
    if (secs > 0) {
      keepBest(longSessionBy, here(secs));
      if (secs > longestSession.value) {
        longestSession = {
          holderId: a.athleteId,
          value: secs,
          detail: formatDay(a.occurredOn),
          context: { kind: "activity", activityId: a.id },
        };
      }
    }

    const dk = `${a.athleteId}|${a.occurredOn}`;
    dayPts.set(dk, (dayPts.get(dk) ?? 0) + p);
    daySessions.set(dk, (daySessions.get(dk) ?? 0) + 1);
    const wk = weekStart(a.occurredOn);
    const wkk = `${a.athleteId}|${wk}`;
    weekPts.set(wkk, (weekPts.get(wkk) ?? 0) + p);
    weekSessions.set(wkk, (weekSessions.get(wkk) ?? 0) + 1);
    if (secs > 0) {
      daySecs.set(dk, (daySecs.get(dk) ?? 0) + secs);
      weekSecs.set(wkk, (weekSecs.get(wkk) ?? 0) + secs);
    }
    if (a.sport === "gym") weekGym.set(wkk, (weekGym.get(wkk) ?? 0) + 1);
    const mok = `${a.athleteId}|${monthStart(a.occurredOn)}`;
    monthPts.set(mok, (monthPts.get(mok) ?? 0) + p);
    // Distance only — a flat gym "1 km" shouldn't count toward a km record.
    if (SPORT_UNIT[a.sport] === "km") {
      dayKm.set(dk, (dayKm.get(dk) ?? 0) + a.km);
      weekKm.set(wkk, (weekKm.get(wkk) ?? 0) + a.km);
      monthKm.set(mok, (monthKm.get(mok) ?? 0) + a.km);
    }
    let mdays = monthDays.get(mok);
    if (!mdays) monthDays.set(mok, (mdays = new Set()));
    mdays.add(a.occurredOn);
    let dsports = daySports.get(dk);
    if (!dsports) daySports.set(dk, (dsports = new Set()));
    dsports.add(a.sport);
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
  let mostTimeWeek = emptyPeak();
  for (const [k, v] of weekSecs) {
    if (v > mostTimeWeek.value) {
      const [holderId, wk] = k.split("|");
      mostTimeWeek = {
        holderId,
        value: v,
        detail: formatRange([wk, weekEnd(wk)]),
        context: { kind: "week", weekStart: wk },
      };
    }
  }
  let mostTimeDay = emptyPeak();
  for (const [k, v] of daySecs) {
    if (v > mostTimeDay.value) {
      const [holderId, day] = k.split("|");
      mostTimeDay = { holderId, value: v, detail: formatDay(day), context: { kind: "day", day } };
    }
  }
  let busiestDay = emptyPeak();
  for (const [k, v] of daySessions) {
    if (v > busiestDay.value) {
      const [holderId, day] = k.split("|");
      busiestDay = { holderId, value: v, detail: formatDay(day), context: { kind: "day", day } };
    }
  }
  let bestKmWeek = emptyPeak();
  for (const [k, v] of weekKm) {
    if (v > bestKmWeek.value) {
      const [holderId, wk] = k.split("|");
      bestKmWeek = {
        holderId,
        value: v,
        detail: formatRange([wk, weekEnd(wk)]),
        context: { kind: "week", weekStart: wk },
      };
    }
  }
  let bestMonth = emptyPeak();
  for (const [k, v] of monthPts) {
    if (v > bestMonth.value) {
      const [holderId, mo] = k.split("|");
      bestMonth = { holderId, value: v, detail: formatMonth(mo), context: { kind: "month", month: mo } };
    }
  }
  let mostGymWeek = emptyPeak();
  for (const [k, v] of weekGym) {
    if (v > mostGymWeek.value) {
      const [holderId, wk] = k.split("|");
      mostGymWeek = {
        holderId,
        value: v,
        detail: formatRange([wk, weekEnd(wk)]),
        context: { kind: "week", weekStart: wk },
      };
    }
  }
  // Longest run of consecutive days with at least one session.
  const streakBy = new Map<string, HallEntry>();
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
    if (best > 0) {
      keepBest(streakBy, {
        athleteId: holderId, value: best,
        detail: `to ${formatDay(bestEnd)}`,
        context: { kind: "streak", endDay: bestEnd, length: best },
      });
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
  let bestKmMonth = emptyPeak();
  for (const [k, v] of monthKm) {
    if (v > bestKmMonth.value) {
      const [holderId, mo] = k.split("|");
      bestKmMonth = { holderId, value: v, detail: formatMonth(mo), context: { kind: "month", month: mo } };
    }
  }
  let mostActiveMonth = emptyPeak();
  for (const [k, set] of monthDays) {
    if (set.size > mostActiveMonth.value) {
      const [holderId, mo] = k.split("|");
      mostActiveMonth = { holderId, value: set.size, detail: formatMonth(mo), context: { kind: "month", month: mo } };
    }
  }
  let fullestDay = emptyPeak();
  for (const [k, set] of daySports) {
    if (set.size > fullestDay.value) {
      const [holderId, day] = k.split("|");
      fullestDay = { holderId, value: set.size, detail: formatDay(day), context: { kind: "day", day } };
    }
  }

  // Longest run of consecutive weeks clearing the quota on earned points — a
  // gap week (or one that only got there on an admin grant) breaks the streak.
  const quotaStreakBy = new Map<string, HallEntry>();
  let quotaStreak = emptyPeak();
  {
    const byAthlete = new Map<string, Map<string, number>>();
    for (const [k, v] of weekPts) {
      const [ath, wk] = k.split("|");
      let m = byAthlete.get(ath);
      if (!m) byAthlete.set(ath, (m = new Map()));
      m.set(wk, v);
    }
    for (const [ath, weeks] of byAthlete) {
      const keys = [...weeks.keys()].sort();
      let run = 0;
      let best = 0;
      let bestEnd = "";
      for (let wk = keys[0]; wk <= keys[keys.length - 1]; wk = addDays(wk, 7)) {
        if (goal > 0 && (weeks.get(wk) ?? 0) >= goal) {
          run += 1;
          if (run > best) {
            best = run;
            bestEnd = wk;
          }
        } else {
          run = 0;
        }
      }
      if (best > 0) {
        const st = addDays(bestEnd, -7 * (best - 1));
        keepBest(quotaStreakBy, {
          athleteId: ath, value: best,
          detail: formatRange([st, weekEnd(bestEnd)]),
          context: { kind: "range", from: st, to: weekEnd(bestEnd) },
        });
      }
      if (best > quotaStreak.value) {
        const start = addDays(bestEnd, -7 * (best - 1));
        quotaStreak = {
          holderId: ath,
          value: best,
          detail: formatRange([start, weekEnd(bestEnd)]),
          context: { kind: "range", from: start, to: weekEnd(bestEnd) },
        };
      }
    }
  }

  // Fewest days into a week anyone cleared the quota (Mon = 1 … Sun = 7).
  const fastQuotaBy = new Map<string, HallEntry>();
  let fastestQuota = emptyPeak();
  {
    const byWeek = new Map<string, { day: string; pts: number }[]>();
    for (const [k, v] of dayPts) {
      const [ath, day] = k.split("|");
      const key = `${ath}|${weekStart(day)}`;
      let arr = byWeek.get(key);
      if (!arr) byWeek.set(key, (arr = []));
      arr.push({ day, pts: v });
    }
    let fewest = Infinity;
    for (const [key, arr] of byWeek) {
      if (goal <= 0) break;
      arr.sort((a, b) => a.day.localeCompare(b.day));
      let cum = 0;
      let hitDay = "";
      for (const { day, pts: dp } of arr) {
        cum += dp;
        if (cum >= goal) {
          hitDay = day;
          break;
        }
      }
      if (!hitDay) continue;
      const [ath, wk] = key.split("|");
      let di = 1;
      for (let cur = wk; cur < hitDay; cur = addDays(cur, 1)) di += 1;
      {
        const cur = fastQuotaBy.get(ath);
        if (!cur || di < cur.value) {
          fastQuotaBy.set(ath, {
            athleteId: ath, value: di,
            detail: formatRange([wk, weekEnd(wk)]),
            context: { kind: "week", weekStart: wk },
          });
        }
      }
      if (di < fewest) {
        fewest = di;
        fastestQuota = {
          holderId: ath,
          value: di,
          detail: formatRange([wk, weekEnd(wk)]),
          context: { kind: "week", weekStart: wk },
        };
      }
    }
  }

  // The ranking behind each record: one best per athlete, best first. The
  // headline above stays the source of truth for the holder; a test asserts the
  // two agree, so they cannot drift apart silently.
  const E = {
    week: rank(weekPts, wk => formatRange([wk, weekEnd(wk)]), wk => ({ kind: "week", weekStart: wk })),
    month: rank(monthPts, m => formatMonth(m), m => ({ kind: "month", month: m })),
    day: rank(dayPts, d => formatDay(d), d => ({ kind: "day", day: d })),
    session: rankDirect(sessionBy),
    kmmonth: rank(monthKm, m => formatMonth(m), m => ({ kind: "month", month: m })),
    kmweek: rank(weekKm, wk => formatRange([wk, weekEnd(wk)]), wk => ({ kind: "week", weekStart: wk })),
    kmday: rank(dayKm, d => formatDay(d), d => ({ kind: "day", day: d })),
    fullday: rankSets(daySports, d => formatDay(d), d => ({ kind: "day", day: d })),
    busiest: rank(weekSessions, wk => formatRange([wk, weekEnd(wk)]), wk => ({ kind: "week", weekStart: wk })),
    busiestday: rank(daySessions, d => formatDay(d), d => ({ kind: "day", day: d })),
    timeweek: rank(weekSecs, wk => formatRange([wk, weekEnd(wk)]), wk => ({ kind: "week", weekStart: wk })),
    timeday: rank(daySecs, d => formatDay(d), d => ({ kind: "day", day: d })),
    timesession: rankDirect(longSessionBy),
    gymweek: rank(weekGym, wk => formatRange([wk, weekEnd(wk)]), wk => ({ kind: "week", weekStart: wk })),
    streak: rankDirect(streakBy),
    quotastreak: rankDirect(quotaStreakBy),
    // Fewest days is the win here, so this one ranks the other way up.
    fastquota: [...fastQuotaBy.values()].sort((a, b) => a.value - b.value),
    activemonth: rankSets(monthDays, m => formatMonth(m), m => ({ kind: "month", month: m })),
    run: rankDirect(runBy),
    ride: rankDirect(rideBy),
    swim: rankDirect(swimBy),
  };

  return [
    { key: "week", label: "Biggest week", group: "points", glyph: "trophy", unit: "pts", ...bestWeek , entries: E.week },
    { key: "month", label: "Biggest month", group: "points", glyph: "medal", unit: "pts", ...bestMonth , entries: E.month },
    { key: "day", label: "Most points in a day", group: "points", glyph: "bolt", unit: "pts", ...bestDay , entries: E.day },
    { key: "session", label: "Biggest single session", group: "points", glyph: "star", unit: "pts", ...bigDaySession , entries: E.session },
    { key: "kmmonth", label: "Most km in a month", group: "distance", glyph: "compass", unit: "km", ...bestKmMonth , entries: E.kmmonth },
    { key: "kmweek", label: "Most km in a week", group: "distance", glyph: "mountain", unit: "km", ...bestKmWeek , entries: E.kmweek },
    { key: "kmday", label: "Most km in a day", group: "distance", glyph: "target", unit: "km", ...bestKmDay , entries: E.kmday },
    { key: "fullday", label: "Most disciplines in a day", group: "volume", glyph: "rings", unit: "sports", ...fullestDay , entries: E.fullday },
    { key: "busiest", label: "Busiest week", group: "volume", glyph: "trio", unit: "sessions", ...busiestWeek , entries: E.busiest },
    { key: "busiestday", label: "Busiest day", group: "volume", glyph: "rocket", unit: "sessions", ...busiestDay , entries: E.busiestday },
    { key: "timeweek", label: "Most time in a week", group: "volume", glyph: "moon", unit: "time", ...mostTimeWeek , entries: E.timeweek },
    { key: "timeday", label: "Most time in a day", group: "volume", glyph: "wave", unit: "time", ...mostTimeDay , entries: E.timeday },
    { key: "timesession", label: "Longest session", group: "volume", glyph: "crown", unit: "time", ...longestSession , entries: E.timesession },
    { key: "gymweek", label: "Most gym workouts", group: "volume", glyph: "dumbbell", unit: "sessions", ...mostGymWeek , entries: E.gymweek },
    { key: "streak", label: "Longest streak", group: "consistency", glyph: "flame", unit: "days", ...longestStreak , entries: E.streak },
    { key: "quotastreak", label: "Longest quota streak", group: "consistency", glyph: "shield", unit: "weeks", ...quotaStreak , entries: E.quotastreak },
    { key: "fastquota", label: "Fastest to quota", group: "consistency", glyph: "diamond", unit: "days", ...fastestQuota , entries: E.fastquota },
    { key: "activemonth", label: "Most days in a month", group: "consistency", glyph: "flag", unit: "days", ...mostActiveMonth , entries: E.activemonth },
    { key: "run", label: "Longest run", group: "distance", sport: "run", unit: "km", ...longestRun , entries: E.run },
    { key: "ride", label: "Longest ride", group: "distance", sport: "bike", unit: "km", ...longestRide , entries: E.ride },
    { key: "swim", label: "Longest swim", group: "distance", sport: "swim", unit: "km", ...longestSwim , entries: E.swim },
  ];
}
