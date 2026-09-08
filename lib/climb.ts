import type { Activity, Athlete } from "./types";
import { isGrant } from "./types";
import { inRange, type DayKey } from "./dates";

/**
 * King of the Mountains — the league ranked by metres climbed.
 *
 * The elevation has been on every Strava session all along, and the rules
 * already pay for it twice (a point per 100 m on the bike, and 100 m of running
 * ascent counting as a kilometre), but nothing ever ranked it. That made it the
 * one axis in the app nobody was competing on.
 *
 * It is worth its own board because it has a DIFFERENT WINNER. The points table
 * is decided by whoever rides the most kilometres; the climbing table is decided
 * by where those kilometres went. On foot the order inverts almost completely —
 * the athletes at the bottom of the points board are the ones going uphill.
 *
 * Bike and run only. Those are the two the rules reward, and the two where
 * ascent means anything: a pool has no gradient, and the metres Strava puts on
 * an indoor gym session are noise.
 */

export const CLIMB_SPORTS = ["bike", "run"] as const;
export type ClimbSport = (typeof CLIMB_SPORTS)[number];

export interface ClimbRow {
  athlete: Athlete;
  /** Metres of ascent across every counted sport. */
  total: number;
  /** Split by sport, for the bar and for the two sub-titles. */
  bySport: Record<ClimbSport, number>;
  /** Sessions that recorded any ascent at all. */
  sessions: number;
  rank: number;
}

function emptySplit(): Record<ClimbSport, number> {
  return { bike: 0, run: 0 };
}

function isClimbSport(s: string): s is ClimbSport {
  return (CLIMB_SPORTS as readonly string[]).includes(s);
}

/**
 * Metres climbed per athlete inside `range`, ranked.
 *
 * Everyone appears, including athletes on nothing — a climbing board that drops
 * the people who stayed flat doesn't show you that they stayed flat.
 */
export function climbStandings(
  athletes: Athlete[],
  activities: Activity[],
  range: [DayKey, DayKey],
): ClimbRow[] {
  const rows = new Map<string, ClimbRow>();
  for (const athlete of athletes) {
    rows.set(athlete.id, { athlete, total: 0, bySport: emptySplit(), sessions: 0, rank: 0 });
  }

  for (const a of activities) {
    // A grant is points, not a climb. Nobody was awarded a mountain.
    if (isGrant(a)) continue;
    if (!isClimbSport(a.sport)) continue;
    if (!inRange(a.occurredOn, range)) continue;
    const m = a.elevationM ?? 0;
    if (m <= 0) continue;
    const row = rows.get(a.athleteId);
    if (!row) continue;
    row.total += m;
    row.bySport[a.sport] += m;
    row.sessions += 1;
  }

  const list = [...rows.values()].sort(
    (x, y) => y.total - x.total || x.athlete.name.localeCompare(y.athlete.name),
  );

  // Equal totals share a place; the next athlete drops by the tie count — the
  // same ranking the points board uses.
  let rank = 0;
  let seen = 0;
  let prev: number | null = null;
  for (const row of list) {
    seen += 1;
    if (prev === null || Math.abs(row.total - prev) > 1e-9) {
      rank = seen;
      prev = row.total;
    }
    row.rank = rank;
  }
  return list;
}

/** Whoever has climbed the most in one discipline, or null if nobody has. */
export function climbLeader(
  rows: ClimbRow[],
  sport: ClimbSport,
): { athlete: Athlete; metres: number } | null {
  let best: ClimbRow | null = null;
  for (const r of rows) {
    if (r.bySport[sport] <= 0) continue;
    if (!best || r.bySport[sport] > best.bySport[sport]) best = r;
  }
  return best ? { athlete: best.athlete, metres: best.bySport[sport] } : null;
}

/** Metres, with a thousands separator and no decimals — nobody climbs 1181.4 m. */
export function fmtMetres(m: number): string {
  return Math.round(m).toLocaleString("en-US");
}
