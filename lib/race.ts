import type { Activity, Athlete, Settings } from "./types";
import { standingsForRange } from "./scoring";
import { addDays, daysBetween, type DayKey } from "./dates";
import { seasonFor, type SeasonInfo } from "./season";

/**
 * The season run-in: who leads, by how much, and where everyone lands if the
 * next few weeks look like the last two.
 *
 * The board can already rank a season, but a ranked list is a scoreboard, not a
 * race — it says Philippe is on 863 and Ryan on 860 without ever saying that
 * three points and three weeks are all that separate them. Everything here is
 * derived from the same standings the board draws, so the two can never
 * disagree; this module only answers the questions the list leaves out.
 *
 * FORM, NOT THE SEASON AVERAGE. The projection deliberately runs on the last
 * two weeks rather than points-per-day across the whole season, and the reason
 * is arithmetic rather than taste: a season average is points/daysGone, so a
 * projection built on it is points x (1 + daysLeft/daysGone) — a strictly
 * increasing function of the points someone already has. It can reorder nobody.
 * It could never say "Ryan catches Philippe", which is the only thing anyone
 * wants to know in a three-point race. Recent form can.
 *
 * It is still the dumbest defensible model, and shouldn't be dressed as a
 * forecast: it says "keep the last fortnight up and here's where you finish".
 */

/** How much of the recent past counts as "current form", in days. Two weeks:
 *  long enough that one rest day doesn't halve someone's projection, short
 *  enough that a fast finish or a fortnight off actually shows up. */
export const FORM_DAYS = 14;

export interface RaceRow {
  athlete: Athlete;
  points: number;
  rank: number;
  /** Points behind the leader. Zero for the leader (and anyone level). */
  behind: number;
  /** Points behind whoever is directly above on the table. Zero at the top. */
  behindAhead: number;
  /** Points scored inside the form window. */
  formPoints: number;
  /** Points per day across the form window — "current rate". */
  rate: number;
  /** Where that rate lands them on the final day. */
  projected: number;
  /** Their place on the projected table, which can differ from `rank`. */
  projectedRank: number;
  /**
   * Points per day needed to finish level with where the leader is heading —
   * chasing the leader's projection, not their current total, because the
   * leader doesn't stop while you catch up.
   *
   * Null for the leader, and null once no days remain to do it in.
   */
  needPerDay: number | null;
}

export interface SeasonRace {
  season: SeasonInfo;
  /** Days of the season run so far, today included. At least 1. */
  daysGone: number;
  /** Whole days still to come. Today is already under way, so it isn't one of
   *  them: this is 0 on the final day. */
  daysLeft: number;
  /** Days the form window actually spans — shorter than FORM_DAYS early on,
   *  when the season itself is younger than the window. */
  formDays: number;
  /** Points between first and second — the headline number. */
  margin: number;
  /** True when the projected table puts someone other than the current leader
   *  on top: the race is live rather than a procession. */
  leadChanges: boolean;
  /** Table order: points, then name. The same ordering the board uses. */
  rows: RaceRow[];
}

/** Standard competition ranking (1, 2, 2, 4) over an already-sorted list. */
function rankBy<T>(sorted: T[], valueOf: (row: T) => number): Map<T, number> {
  const out = new Map<T, number>();
  let rank = 0;
  let seen = 0;
  let prev: number | null = null;
  for (const row of sorted) {
    seen += 1;
    const v = valueOf(row);
    if (prev === null || Math.abs(v - prev) > 1e-9) {
      rank = seen;
      prev = v;
    }
    out.set(row, rank);
  }
  return out;
}

/**
 * The race for the season containing `refDay`, or null before Season 1 opens.
 *
 * Athletes on nothing are kept in the table: a season race that quietly drops
 * the people losing it is not a table of the season.
 */
export function seasonRace(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  refDay: DayKey,
): SeasonRace | null {
  const season = seasonFor(refDay, settings.seasonStart);
  if (!season) return null;

  // Season 1 opens on the kickoff, which can be days into its own month block,
  // so `refDay` can sit inside the season's months but before its first scoring
  // day. Clamp rather than go negative — on those days the race simply hasn't
  // run for any time yet.
  const daysGone = Math.max(1, daysBetween(season.start, refDay) + 1);
  const daysLeft = Math.max(0, daysBetween(refDay, season.end));

  // The form window never reaches back before the season opened: points from
  // last season are not this season's form.
  const windowOpens =
    addDays(refDay, -(FORM_DAYS - 1)) < season.start
      ? season.start
      : addDays(refDay, -(FORM_DAYS - 1));
  const formDays = Math.max(1, daysBetween(windowOpens, refDay) + 1);

  const standings = standingsForRange(athletes, activities, settings, [
    season.start,
    season.end,
  ]);
  const form = new Map(
    standingsForRange(athletes, activities, settings, [windowOpens, refDay]).map((s) => [
      s.athlete.id,
      s.points,
    ]),
  );

  const rateOf = (id: string) => (form.get(id) ?? 0) / formDays;
  const leader = standings[0];
  const leaderTarget = leader ? leader.points + rateOf(leader.athlete.id) * daysLeft : 0;

  const rows: RaceRow[] = standings.map((s, i) => {
    const rate = rateOf(s.athlete.id);
    return {
      athlete: s.athlete,
      points: s.points,
      rank: s.rank,
      behind: leader ? leader.points - s.points : 0,
      behindAhead: i === 0 ? 0 : standings[i - 1].points - s.points,
      formPoints: form.get(s.athlete.id) ?? 0,
      rate,
      projected: s.points + rate * daysLeft,
      projectedRank: 0, // filled in below
      needPerDay:
        s.rank === 1 || daysLeft === 0
          ? null
          : Math.max(0, leaderTarget - s.points) / daysLeft,
    };
  });

  const byProjection = [...rows].sort(
    (a, b) => b.projected - a.projected || a.athlete.name.localeCompare(b.athlete.name),
  );
  const projRank = rankBy(byProjection, (r) => r.projected);
  for (const r of rows) r.projectedRank = projRank.get(r) ?? 0;

  const leadChanges =
    !!leader && byProjection.length > 0 && byProjection[0].athlete.id !== leader.athlete.id;

  return {
    season,
    daysGone,
    daysLeft,
    formDays,
    margin: standings.length >= 2 ? standings[0].points - standings[1].points : 0,
    leadChanges,
    rows,
  };
}
