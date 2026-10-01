import type { Activity, Athlete, Settings, Sport } from "./types";
import { standingsForRange } from "./scoring";
import {
  formatRange,
  monthEnd,
  monthStart,
  weekEnd,
  weekStart,
  type DayKey,
} from "./dates";

/**
 * Head-to-head bets.
 *
 * The one rule that shapes everything here: **a bet is settled by the board,
 * never by a person.** Two men who already disagree about who trained harder
 * are not going to agree about who won the bet, so the only bets this app will
 * take are ones it can decide itself out of the log — a number, over a window,
 * for each of them.
 *
 * And like coins (lib/coins.ts), the OUTCOME IS DERIVED. What is stored is the
 * terms and the handshake; who won is worked out at read time from the same
 * activities the Board is drawn from. That buys three things:
 *
 *  * No cron has to fire at midnight on Sunday to settle anything.
 *  * A rescored week — a session struck off, a Strava import arriving late —
 *    corrects the bet with it, instead of leaving a paid-out bet disagreeing
 *    with the table it was about.
 *  * There is no second ledger that can drift out of step with the first.
 *
 * The cost is that a stake is not held while the bet runs: both balances only
 * move when the window closes. The API checks both sides can cover the stake
 * at the moment of ACCEPTANCE, which is the moment the bet becomes real.
 */

export type BetState = "open" | "accepted" | "declined" | "cancelled";

/** What the two of them are actually racing on. */
export type BetMetric = "points" | "km" | "sessions" | Sport;

export interface Bet {
  id: string;
  /** Who proposed it, and whose coins are on the line first. */
  fromId: string;
  toId: string;
  metric: BetMetric;
  /** "week" or "month" — which calendar block it is decided over. */
  period: "week" | "month";
  /** The first day of that block. Stored, not derived, so a bet proposed on
   *  Sunday for "this week" cannot quietly become next week's bet on Monday. */
  startsOn: DayKey;
  stake: number;
  state: BetState;
  note: string;
  createdAt: string;
  /** When it was accepted or declined. Null while it is still an offer. */
  decidedAt: string | null;
}

export const BET_METRICS: { id: BetMetric; label: string; unit: string }[] = [
  { id: "points", label: "Points", unit: "pts" },
  { id: "km", label: "Distance", unit: "km" },
  { id: "sessions", label: "Sessions", unit: "" },
  { id: "swim", label: "Swim distance", unit: "km" },
  { id: "bike", label: "Bike distance", unit: "km" },
  { id: "run", label: "Run distance", unit: "km" },
  { id: "gym", label: "Gym sessions", unit: "" },
];

export const BET_METRIC_BY_ID = new Map(BET_METRICS.map((m) => [m.id, m]));

/** The smallest and largest a stake may be. A bet nobody feels is not a bet. */
export const STAKE_MIN = 10;
export const STAKE_MAX = 2000;

/** The window a bet is decided over, as a pair of days. */
export function betRange(bet: Pick<Bet, "period" | "startsOn">): [DayKey, DayKey] {
  return bet.period === "week"
    ? [weekStart(bet.startsOn), weekEnd(bet.startsOn)]
    : [monthStart(bet.startsOn), monthEnd(bet.startsOn)];
}

/** That window in words, for a card: "28 Sep – 4 Oct". */
export function betWhen(bet: Pick<Bet, "period" | "startsOn">): string {
  return formatRange(betRange(bet));
}

/**
 * One athlete's number for one metric over a range.
 *
 * Read off `standingsForRange` rather than summed here, so a bet on points
 * counts points exactly the way the Board does — gym cap, grants, excuses and
 * all. A bet that disagreed with the table it is about would be worse than no
 * bet at all.
 */
export function betValue(
  athleteId: string,
  metric: BetMetric,
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  range: [DayKey, DayKey],
): number {
  const row = standingsForRange(athletes, activities, settings, range)
    .find((s) => s.athlete.id === athleteId);
  if (!row) return 0;
  if (metric === "points") return row.points;
  if (metric === "km") return row.km;
  if (metric === "sessions") return row.sessions;
  // A gym "distance" is meaningless, so the gym bet counts workouts; every
  // other sport counts kilometres.
  if (metric === "gym") {
    return activities.filter(
      (a) => a.athleteId === athleteId && a.sport === "gym"
        && a.occurredOn >= range[0] && a.occurredOn <= range[1],
    ).length;
  }
  return row.kmBySport[metric] ?? 0;
}

export type BetStatus = "offered" | "declined" | "cancelled" | "live" | "settled";

export interface BetResult {
  status: BetStatus;
  /** Where the two of them stand — live while it runs, final once it's over. */
  from: number;
  to: number;
  /** Null until it is over; null forever on a draw. */
  winnerId: string | null;
  /** A settled bet nobody won: the stakes go back. */
  push: boolean;
  range: [DayKey, DayKey];
}

/**
 * Where a bet stands today.
 *
 * `today` is passed in rather than read from the clock, because every test and
 * every screen in this app agrees on what day it is through lib/dates and this
 * must not be the one place that asks the machine.
 */
export function betResult(
  bet: Bet,
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  today: DayKey,
): BetResult {
  const range = betRange(bet);
  const from = betValue(bet.fromId, bet.metric, athletes, activities, settings, range);
  const to = betValue(bet.toId, bet.metric, athletes, activities, settings, range);
  const base = { from, to, winnerId: null, push: false, range } as const;

  if (bet.state === "open") return { ...base, status: "offered" };
  if (bet.state === "declined") return { ...base, status: "declined" };
  if (bet.state === "cancelled") return { ...base, status: "cancelled" };
  if (today <= range[1]) return { ...base, status: "live" };

  if (from === to) return { ...base, status: "settled", push: true };
  return { ...base, status: "settled", winnerId: from > to ? bet.fromId : bet.toId };
}

/** The coins a settled bet moves for one athlete: +stake, -stake, or nothing. */
export function betCoins(
  athleteId: string,
  bet: Bet,
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  today: DayKey,
): { amount: number; result: BetResult } | null {
  if (bet.fromId !== athleteId && bet.toId !== athleteId) return null;
  const result = betResult(bet, athletes, activities, settings, today);
  if (result.status !== "settled" || result.push) return null;
  return { amount: result.winnerId === athleteId ? bet.stake : -bet.stake, result };
}

/**
 * Whether these two already have this exact bet running.
 *
 * Without it, tapping "propose" twice on a slow connection makes two bets for
 * the same stake on the same week, and the second one is a loss nobody agreed
 * to.
 */
export function duplicateBet(
  bets: Bet[],
  fromId: string,
  toId: string,
  metric: BetMetric,
  startsOn: DayKey,
): Bet | undefined {
  return bets.find(
    (b) => (b.state === "open" || b.state === "accepted")
      && b.metric === metric && b.startsOn === startsOn
      && ((b.fromId === fromId && b.toId === toId) || (b.fromId === toId && b.toId === fromId)),
  );
}
