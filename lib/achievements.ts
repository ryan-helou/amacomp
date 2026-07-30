import type { Activity, Athlete, Settings, Sport } from "./types";
import { SPORT_UNIT } from "./types";
import {
  addDays,
  formatMonth,
  formatRange,
  monthEnd,
  monthStart,
  monthsBetween,
  today,
  weekEnd,
  weekStart,
  type DayKey,
} from "./dates";
import {
  activityPoints,
  standingsForRange,
  type Standing,
} from "./scoring";

/**
 * Everything fun in AmaComp — streaks, badges, weekly champions, rivalries,
 * movement — is derived from the same activity log at read time. No extra
 * storage: change a multiplier and the whole season's stats recompute.
 */

// ---------------------------------------------------------------------------
// Weekly buckets
// ---------------------------------------------------------------------------

/** athleteId → (Monday-of-week key → points that week). */
function weeklyPoints(
  activities: Activity[],
  settings: Settings,
): Map<string, Map<DayKey, number>> {
  const out = new Map<string, Map<DayKey, number>>();
  for (const a of activities) {
    const wk = weekStart(a.occurredOn);
    let weeks = out.get(a.athleteId);
    if (!weeks) out.set(a.athleteId, (weeks = new Map()));
    weeks.set(wk, (weeks.get(wk) ?? 0) + activityPoints(a, settings));
  }
  return out;
}

/** Inclusive list of Monday keys from the earliest activity to this week. */
function weekTimeline(activities: Activity[], refDay: DayKey): DayKey[] {
  if (activities.length === 0) return [weekStart(refDay)];
  let earliest = activities[0].occurredOn;
  for (const a of activities) if (a.occurredOn < earliest) earliest = a.occurredOn;
  const first = weekStart(earliest);
  const last = weekStart(refDay);
  const keys: DayKey[] = [];
  for (let k = first; k <= last; k = addDays(k, 7)) keys.push(k);
  return keys;
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

export interface Streak {
  current: number;
  best: number;
}

export function streakFor(
  athleteId: string,
  activities: Activity[],
  settings: Settings,
  refDay: DayKey = today(),
): Streak {
  const goal = settings.weeklyGoal;
  const weeks = weeklyPoints(activities, settings).get(athleteId) ?? new Map();
  const timeline = weekTimeline(activities, refDay);
  const hit = (wk: DayKey) => (weeks.get(wk) ?? 0) >= goal && goal > 0;

  // Best: longest run of consecutive hit weeks across the whole timeline.
  let best = 0;
  let run = 0;
  for (const wk of timeline) {
    if (hit(wk)) best = Math.max(best, ++run);
    else run = 0;
  }

  // Current: count back from this week. An in-progress week that isn't hit yet
  // doesn't break a streak built on earlier weeks — start counting one back.
  const thisWeek = weekStart(refDay);
  let cursor = hit(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  let current = 0;
  while (hit(cursor)) {
    current += 1;
    cursor = addDays(cursor, -7);
  }

  return { current, best };
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface Badge {
  id: string;
  glyph: string;
  name: string;
  detail: string;
  earned: boolean;
}

export function badgesFor(
  athleteId: string,
  activities: Activity[],
  settings: Settings,
  refDay: DayKey = today(),
): Badge[] {
  const mine = activities.filter((a) => a.athleteId === athleteId);
  const sportsEver = new Set<Sport>();
  let sessions = 0;
  let kmTotal = 0;
  let gymCount = 0;
  const dayPoints = new Map<DayKey, number>();
  const weekSports = new Map<DayKey, Set<Sport>>();

  for (const a of mine) {
    sessions += 1;
    sportsEver.add(a.sport);
    if (SPORT_UNIT[a.sport] === "km") kmTotal += a.km;
    if (a.sport === "gym") gymCount += 1;
    dayPoints.set(
      a.occurredOn,
      (dayPoints.get(a.occurredOn) ?? 0) + activityPoints(a, settings),
    );
    const wk = weekStart(a.occurredOn);
    let s = weekSports.get(wk);
    if (!s) weekSports.set(wk, (s = new Set()));
    s.add(a.sport);
  }

  const maxDay = Math.max(0, ...dayPoints.values());
  const tripleWeek = [...weekSports.values()].some(
    (s) => s.has("swim") && s.has("bike") && s.has("run"),
  );
  const { best } = streakFor(athleteId, activities, settings, refDay);
  const hitAnyWeek = best >= 1;
  const allFour =
    sportsEver.has("swim") &&
    sportsEver.has("bike") &&
    sportsEver.has("run") &&
    sportsEver.has("gym");

  const catalog: (Omit<Badge, "earned"> & { earned: boolean })[] = [
    { id: "first-splash", glyph: "drop", name: "First Splash", detail: "Log your first session", earned: sessions >= 1 },
    { id: "iron-will", glyph: "target", name: "Iron Will", detail: "Hit the weekly quota", earned: hitAnyWeek },
    { id: "hat-trick", glyph: "flame", name: "Hat Trick", detail: "3 weeks of quota in a row", earned: best >= 3 },
    { id: "triple-threat", glyph: "trio", name: "Triple Threat", detail: "Swim, bike and run in one week", earned: tripleWeek },
    { id: "centurion", glyph: "medal", name: "Centurion", detail: "100 km logged all-time", earned: kmTotal >= 100 },
    { id: "big-day", glyph: "star", name: "Big Day", detail: "50+ points in a single day", earned: maxDay >= 50 },
    { id: "all-rounder", glyph: "rings", name: "All-Rounder", detail: "Log all four disciplines", earned: allFour },
    { id: "gym-rat", glyph: "dumbbell", name: "Gym Rat", detail: "10 gym workouts", earned: gymCount >= 10 },
  ];
  return catalog;
}

// ---------------------------------------------------------------------------
// Weekly champion recap (the closed, previous week)
// ---------------------------------------------------------------------------

export interface WeekRecap {
  rangeLabel: string;
  champion: Standing;
  hit: Standing[];
  missed: Standing[];
}

export function lastWeekRecap(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  refDay: DayKey = today(),
): WeekRecap | null {
  const prevRef = addDays(weekStart(refDay), -1); // a day inside last week
  const range: [DayKey, DayKey] = [weekStart(prevRef), weekEnd(prevRef)];
  // Don't crown a "last week" champion for weeks that ended before the season
  // even started — the recap panel is a victory lap, not a warm-up write-up.
  if (range[0] < weekStart(settings.seasonStart)) return null;
  const standings = standingsForRange(athletes, activities, settings, range);
  if (!standings.some((s) => s.points > 0)) return null;
  const goal = settings.weeklyGoal;
  return {
    rangeLabel: formatRange(range),
    champion: standings[0],
    hit: standings.filter((s) => s.points >= goal),
    missed: standings.filter((s) => s.points < goal),
  };
}

// ---------------------------------------------------------------------------
// Season championships (weekly wins, completed weeks only)
// ---------------------------------------------------------------------------

export function championshipsByAthlete(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  refDay: DayKey = today(),
): Map<string, number> {
  const wins = new Map<string, number>();
  const thisWeek = weekStart(refDay);
  // No trophies for pre-season weeks — warm-up logging shouldn't crown anyone.
  const seasonWeek = weekStart(settings.seasonStart);
  for (const wk of weekTimeline(activities, refDay)) {
    if (wk >= thisWeek) continue; // only completed weeks crown a champion
    if (wk < seasonWeek) continue; // pre-kickoff weeks don't count
    const range: [DayKey, DayKey] = [wk, weekEnd(wk)];
    const standings = standingsForRange(athletes, activities, settings, range);
    const top = standings[0];
    if (!top || top.points <= 0) continue;
    // Co-champions share a win on an exact tie.
    for (const s of standings) {
      if (Math.abs(s.points - top.points) < 1e-9) {
        wins.set(s.athlete.id, (wins.get(s.athlete.id) ?? 0) + 1);
      }
    }
  }
  return wins;
}

// ---------------------------------------------------------------------------
// Week-wins leaderboard (ranked by number of weekly championships)
// ---------------------------------------------------------------------------

export interface WinRow {
  athlete: Athlete;
  wins: number;
  rank: number;
}

export function weekWinsBoard(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  refDay: DayKey = today(),
): WinRow[] {
  const wins = championshipsByAthlete(athletes, activities, settings, refDay);
  const rows = athletes
    .map((athlete) => ({ athlete, wins: wins.get(athlete.id) ?? 0, rank: 0 }))
    .sort((a, b) => b.wins - a.wins || a.athlete.name.localeCompare(b.athlete.name));

  let rank = 0;
  let seen = 0;
  let prev: number | null = null;
  for (const row of rows) {
    seen += 1;
    if (prev === null || row.wins !== prev) {
      rank = seen;
      prev = row.wins;
    }
    row.rank = rank;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Monthly champions (hall of fame)
// ---------------------------------------------------------------------------

export interface MonthChampion {
  monthKey: DayKey;
  label: string;
  champion: Standing;
  isCurrent: boolean;
}

export function monthlyChampions(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  refDay: DayKey = today(),
): MonthChampion[] {
  if (activities.length === 0) return [];
  let earliest = activities[0].occurredOn;
  for (const a of activities) if (a.occurredOn < earliest) earliest = a.occurredOn;

  const curMonth = monthStart(refDay);
  const out: MonthChampion[] = [];
  for (const mk of monthsBetween(earliest, refDay)) {
    const range: [DayKey, DayKey] = [monthStart(mk), monthEnd(mk)];
    const standings = standingsForRange(athletes, activities, settings, range);
    const top = standings[0];
    if (!top || top.points <= 0) continue;
    out.push({
      monthKey: mk,
      label: formatMonth(mk),
      champion: top,
      isCurrent: mk === curMonth,
    });
  }
  return out.reverse(); // newest month first
}

// ---------------------------------------------------------------------------
// Head-to-head (the rival right next to you this week)
// ---------------------------------------------------------------------------

export interface HeadToHead {
  me: Standing;
  rival: Standing;
  /** Positive = you lead by this much; negative = you trail. */
  diff: number;
  leading: boolean;
}

export function headToHead(
  weekStandings: Standing[],
  meId: string,
): HeadToHead | null {
  const i = weekStandings.findIndex((s) => s.athlete.id === meId);
  if (i === -1 || weekStandings.length < 2) return null;
  const me = weekStandings[i];
  // The chaser below if you lead, otherwise the athlete just ahead of you.
  const rival = i === 0 ? weekStandings[1] : weekStandings[i - 1];
  const diff = me.points - rival.points;
  return { me, rival, diff, leading: i === 0 };
}

// ---------------------------------------------------------------------------
// Movement — rank now vs rank as of yesterday, within this week
// ---------------------------------------------------------------------------

export interface Movement {
  delta: number; // +ve = climbed, -ve = dropped
  passed: string[]; // names you moved ahead of since yesterday
}

export function movementByAthlete(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  refDay: DayKey = today(),
): Map<string, Movement> {
  const out = new Map<string, Movement>();
  const wkStart = weekStart(refDay);
  const yesterday = addDays(refDay, -1);

  const nowStandings = standingsForRange(athletes, activities, settings, [
    wkStart,
    refDay,
  ]);
  const nowRank = new Map(nowStandings.map((s) => [s.athlete.id, s.rank]));

  // No "yesterday" inside this week yet (it's Monday) → nobody has moved.
  if (yesterday < wkStart) {
    for (const a of athletes) out.set(a.id, { delta: 0, passed: [] });
    return out;
  }

  const yStandings = standingsForRange(athletes, activities, settings, [
    wkStart,
    yesterday,
  ]);
  const yRank = new Map(yStandings.map((s) => [s.athlete.id, s.rank]));
  const nameOf = new Map(athletes.map((a) => [a.id, a.name]));

  for (const a of athletes) {
    const rn = nowRank.get(a.id) ?? 0;
    const ry = yRank.get(a.id) ?? 0;
    const passed: string[] = [];
    for (const other of athletes) {
      if (other.id === a.id) continue;
      const on = nowRank.get(other.id) ?? 0;
      const oy = yRank.get(other.id) ?? 0;
      // Behind them yesterday, ahead of them now.
      if (ry > oy && rn < on) passed.push(nameOf.get(other.id) ?? "");
    }
    out.set(a.id, { delta: ry - rn, passed });
  }
  return out;
}
