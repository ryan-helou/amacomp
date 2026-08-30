import type { Activity, Athlete, Settings, Sport } from "./types";
import { SPORTS, SPORT_UNIT, isGrant, isExcuse } from "./types";
import { inRange, type DayKey, type Period, periodRange } from "./dates";
import { MAX_SCORING_GYM_PER_DAY } from "./validate";

/** The scoring rates in force on a given day. */
export interface Rates {
  multipliers: Record<Sport, number>;
  elevationPer100m: Record<Sport, number>;
}

/**
 * The rates that applied on `day`: the base rates with every dated change whose
 * `from` has arrived layered over them, oldest first.
 *
 * Points are still derived at read time — nothing is ever frozen into a row —
 * but they are derived from the rules that were in force when the session
 * happened. Changing a rate therefore moves the weeks ahead of it and leaves the
 * weeks behind it exactly as they were scored, which is what stops a rule change
 * from retroactively handing out or taking away a forfeit.
 *
 * Each change is a partial: one that names only `run` moves run alone.
 */
export function ratesOn(day: DayKey, settings: Settings): Rates {
  const multipliers = { ...settings.multipliers };
  const elevationPer100m = { ...(settings.elevationPer100m ?? emptySportMap()) };
  // `from` is inclusive, and the list is kept oldest-first, so the newest change
  // that has already started is the last one applied and therefore wins.
  for (const change of settings.rateChanges ?? []) {
    if (change.from > day) continue;
    for (const sport of SPORTS) {
      const m = change.multipliers?.[sport];
      if (typeof m === "number" && Number.isFinite(m)) multipliers[sport] = m;
      const e = change.elevationPer100m?.[sport];
      if (typeof e === "number" && Number.isFinite(e)) elevationPer100m[sport] = e;
    }
  }
  return { multipliers, elevationPer100m };
}

/**
 * Points for a distance on a given day. `day` is required rather than defaulted:
 * a forgotten argument would score a session at the wrong era's rates, and the
 * compiler catching that is worth more than the convenience.
 */
export function pointsFor(
  km: number,
  sport: Sport,
  settings: Settings,
  day: DayKey,
): number {
  return km * (ratesOn(day, settings).multipliers[sport] ?? 0);
}

/**
 * Points for the climbing in a session, on top of the distance points.
 * Proportional like everything else here — 250 m at 1/100m is 2.5, not 2 — so a
 * ride is never worth less than the sum of its halves.
 *
 * `null` elevation means we don't know (a hand-logged ride, or a Strava pull
 * from before we stored it) and scores nothing. That's the honest reading: it
 * can't be treated as flat, and inventing a number would hand out points nobody
 * earned.
 */
export function elevationPointsFor(
  elevationM: number | null,
  sport: Sport,
  settings: Settings,
  day: DayKey,
): number {
  if (elevationM === null || !Number.isFinite(elevationM) || elevationM <= 0) return 0;
  return (elevationM / 100) * (ratesOn(day, settings).elevationPer100m?.[sport] ?? 0);
}

/**
 * Points for one activity. Pass the set from `unscoredGymIds` to have
 * over-the-cap gym workouts score zero; omit it when you genuinely want the
 * face value (e.g. the "Worth" preview on the log form, before it's saved).
 */
export function activityPoints(
  a: Activity,
  settings: Settings,
  unscored?: Set<string>,
): number {
  // An admin grant carries its points directly — no sport, no distance.
  if (isGrant(a)) return a.points ?? 0;
  if (unscored?.has(a.id)) return 0;
  // The day the session happened picks the rates — not today's.
  return (
    pointsFor(a.km, a.sport, settings, a.occurredOn) +
    elevationPointsFor(a.elevationM, a.sport, settings, a.occurredOn)
  );
}

/**
 * The gym workouts that fall past the per-day cap, as a set of activity ids.
 * Earliest-logged wins, so the cap can never retroactively un-score a session
 * that already counted. Computed over whatever list is passed in — callers hand
 * over the full activity list, and range filtering happens afterwards, so a
 * week view and an all-time view agree on which workouts scored.
 */
export function unscoredGymIds(activities: Activity[]): Set<string> {
  const byAthleteDay = new Map<string, Activity[]>();
  for (const a of activities) {
    if (isGrant(a)) continue;
    if (SPORT_UNIT[a.sport] !== "flat") continue;
    const key = `${a.athleteId}|${a.occurredOn}`;
    const list = byAthleteDay.get(key);
    if (list) list.push(a);
    else byAthleteDay.set(key, [a]);
  }

  const unscored = new Set<string>();
  for (const list of byAthleteDay.values()) {
    if (list.length <= MAX_SCORING_GYM_PER_DAY) continue;
    // Stable order: oldest first, id as the tie-break so two logs written in the
    // same millisecond still resolve the same way on every render.
    const ordered = [...list].sort(
      (x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id),
    );
    for (const a of ordered.slice(MAX_SCORING_GYM_PER_DAY)) unscored.add(a.id);
  }
  return unscored;
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
  /** Sessions that came in from Strava rather than being typed by hand. */
  stravaSessions: number;
  /** Gym workouts in this window that were past the daily cap and scored nothing. */
  unscoredSessions: number;
  /** Points the admin awarded directly (already included in `points`), tracked
   *  separately so the UI can show them as granted rather than earned. */
  grantedPoints: number;
  /** True if the admin waived this week for the athlete (an `excuse` grant). */
  excused: boolean;
}

function emptySportMap(): Record<Sport, number> {
  return { swim: 0, bike: 0, run: 0, gym: 0 };
}

export function standingsFor(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  period: Period,
  ref?: DayKey,
): Standing[] {
  return standingsForRange(athletes, activities, settings, periodRange(period, ref));
}

export function standingsForRange(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  range: [DayKey, DayKey],
): Standing[] {
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
      stravaSessions: 0,
      unscoredSessions: 0,
      grantedPoints: 0,
      excused: false,
    });
  }

  // Computed over the whole list, before the range filter, so a capped workout
  // stays capped no matter which window you're looking at.
  const unscored = unscoredGymIds(activities);

  for (const a of activities) {
    if (!inRange(a.occurredOn, range)) continue;
    const row = rows.get(a.athleteId);
    if (!row) continue;
    // Admin grants are points, not a session — they lift the total (and so the
    // quota + rank) but don't touch km, session counts, or the sport split.
    if (isGrant(a)) {
      const pts = a.points ?? 0;
      row.points += pts;
      row.grantedPoints += pts;
      if (isExcuse(a)) row.excused = true;
      continue;
    }
    if (a.source === "strava") row.stravaSessions += 1;
    if (unscored.has(a.id)) {
      // Still a session that happened — it just contributes no points or volume.
      row.sessions += 1;
      row.unscoredSessions += 1;
      continue;
    }
    const pts = activityPoints(a, settings);
    row.points += pts;
    // `km` is the distance total, so gym hours don't get summed into it — they
    // live in kmBySport.gym and surface with their own unit.
    if (SPORT_UNIT[a.sport] === "km") row.km += a.km;
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
  const unscored = unscoredGymIds(activities);
  return activities.reduce((sum, a) => sum + activityPoints(a, settings, unscored), 0);
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
