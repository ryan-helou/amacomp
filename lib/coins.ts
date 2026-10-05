import type { Activity, Athlete, CoinGrant, Purchase, Settings } from "./types";
import { isGrant } from "./types";
import { activityPoints, goalFor, standingsForRange, unscoredGymIds } from "./scoring";
import {
  addDays,
  formatDay,
  formatMonth,
  formatRange,
  monthEnd,
  monthStart,
  today as todayKey,
  weekEnd,
  weekStart,
  type DayKey,
} from "./dates";
import { seasonByNumber, seasonFor } from "./season";
import { betCoins, BET_METRIC_BY_ID, type Bet } from "./bets";
import { bountyCoins, bountyFor, type Bounty } from "./bounties";
import type { Transfer } from "./transfers";
import { AVATAR_ITEM_BY_ID } from "./pixelAvatar";

/**
 * Tri coins — the Club's currency.
 *
 * Coins are DERIVED, never stored as a balance. Every coin traces to something
 * already on the board: points scored, a quota met, a week, month or season
 * won. Nothing has to be minted by a cron job at the right moment, a rescored
 * week corrects itself, and there is no second ledger to drift out of step with
 * the first one.
 *
 * Spending (the shop, bets, gifts) is the part that CAN'T be derived, and that
 * lands later as stored entries which subtract from this total.
 *
 * Coins never touch the standings. Points decide the week, the month and the
 * season; coins only decide what your card looks like.
 */

/** What pays, and how much. Ryan's rates, 2026-09-27. */
export const COIN_RATES = {
  /** Coins per point scored. */
  perPoint: 1,
  quota: 25,
  weekWin: 50,
  monthWin: 100,
  seasonWin: 250,
} as const;

export type CoinKind =
  | "points" | "quota" | "week" | "month" | "season" | "grant" | "spend"
  | "bet" | "bounty" | "gift";

export interface CoinEntry {
  kind: CoinKind;
  /** What it was for, in the athlete's words. */
  label: string;
  /** When, as text — a day, a week range, a month. */
  detail: string;
  amount: number;
  /** The day it's filed under, for sorting. */
  day: DayKey;
}

export interface CoinAccount {
  /** Earned and granted, less what's been spent — what you can actually spend. */
  balance: number;
  /** Everything that ever came IN, before any spending. */
  earned: number;
  /** What the shop has taken, as a positive number. */
  spent: number;
  entries: CoinEntry[];
}

/** Every session in a window, newest first, as the coins they paid. */
function sessionEntries(
  athleteId: string,
  activities: Activity[],
  settings: Settings,
  from: DayKey,
): CoinEntry[] {
  const unscored = unscoredGymIds(activities);
  const out: CoinEntry[] = [];
  for (const a of activities) {
    if (a.athleteId !== athleteId) continue;
    if (a.occurredOn < from) continue;
    if (unscored.has(a.id)) continue;
    const pts = isGrant(a) ? (a.points ?? 0) : activityPoints(a, settings);
    if (pts <= 0) continue;
    out.push({
      kind: "points",
      label: a.note?.trim() || (isGrant(a) ? "Points awarded" : sessionLabel(a)),
      detail: formatDay(a.occurredOn),
      amount: Math.round(pts * COIN_RATES.perPoint),
      day: a.occurredOn,
    });
  }
  return out;
}

function sessionLabel(a: Activity): string {
  const km = a.km > 0 ? `${a.km} km ` : "";
  return `${km}${a.sport}`;
}

/**
 * One athlete's coin account: the balance and the story behind it.
 *
 * `from` bounds the ledger the wallet shows (a season's worth by default) —
 * the balance itself always counts everything since the league opened.
 */
export function coinAccount(
  athleteId: string,
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  refDay: DayKey = todayKey(),
  grants: CoinGrant[] = [],
  purchases: Purchase[] = [],
  bets: Bet[] = [],
  bounties: Bounty[] = [],
  transfers: Transfer[] = [],
): CoinAccount {
  const entries: CoinEntry[] = [];
  const seasonStart = settings.seasonStart;

  // Sessions, all of them — the bulk of any balance.
  entries.push(...sessionEntries(athleteId, activities, settings, seasonStart));

  // Weeks: the quota bonus, and the win. Completed weeks only — a week still
  // running hasn't paid anyone yet, and saying otherwise would let a balance
  // fall on Sunday night when someone overtakes you.
  const thisWeek = weekStart(refDay);
  for (let wk = weekStart(seasonStart); wk < thisWeek; wk = addDays(wk, 7)) {
    const range: [DayKey, DayKey] = [wk, weekEnd(wk)];
    const standings = standingsForRange(athletes, activities, settings, range);
    const mine = standings.find((s) => s.athlete.id === athleteId);
    if (!mine) continue;
    const goal = goalFor(mine.athlete.name, settings, wk);
    if (goal > 0 && mine.quotaPoints >= goal) {
      entries.push({
        kind: "quota",
        label: "Quota met",
        detail: formatRange(range),
        amount: COIN_RATES.quota,
        day: range[1],
      });
    }
    const top = standings[0];
    if (top && top.points > 0 && Math.abs(mine.points - top.points) < 1e-9) {
      entries.push({
        kind: "week",
        label: "Won the week",
        detail: formatRange(range),
        amount: COIN_RATES.weekWin,
        day: range[1],
      });
    }
  }

  // Months and seasons, again only once they've finished.
  const curMonth = monthStart(refDay);
  for (let m = monthStart(seasonStart); m < curMonth; m = monthStart(addDays(monthEnd(m), 1))) {
    const standings = standingsForRange(athletes, activities, settings, [m, monthEnd(m)]);
    const top = standings[0];
    if (top && top.points > 0 && top.athlete.id === athleteId) {
      entries.push({
        kind: "month",
        label: `Won ${formatMonth(m)}`,
        detail: formatMonth(m),
        amount: COIN_RATES.monthWin,
        day: monthEnd(m),
      });
    }
  }

  const current = seasonFor(refDay, seasonStart);
  for (let n = (current?.number ?? 1) - 1; n >= 1; n--) {
    const season = seasonByNumber(n, seasonStart);
    const standings = standingsForRange(athletes, activities, settings, [season.start, season.end]);
    const top = standings[0];
    if (top && top.points > 0 && top.athlete.id === athleteId) {
      entries.push({
        kind: "season",
        label: `Won ${season.label}`,
        detail: season.monthsLabel,
        amount: COIN_RATES.seasonWin,
        day: season.end,
      });
    }
  }

  // Coins handed out by hand: a test float, a bounty paid, a prize settled.
  for (const g of grants) {
    if (g.athleteId !== athleteId) continue;
    entries.push({
      kind: "grant",
      label: g.note || "Granted",
      detail: g.day,
      amount: g.amount,
      day: g.day,
    });
  }

  // Settled bets. DERIVED, like everything else above it: the stored row is
  // the terms and the handshake, and who won is worked out from the same
  // activities the Board is drawn from — so a session struck off a fortnight
  // later moves the bet with the table instead of leaving a paid-out bet
  // disagreeing with it. A bet still running pays nobody, and a draw is a
  // push, so neither appears here at all.
  for (const bet of bets) {
    const moved = betCoins(athleteId, bet, athletes, activities, settings, refDay);
    if (!moved) continue;
    const other = athletes.find(
      (a) => a.id === (bet.fromId === athleteId ? bet.toId : bet.fromId),
    );
    const metric = BET_METRIC_BY_ID.get(bet.metric)?.label ?? bet.metric;
    entries.push({
      kind: "bet",
      label: `${moved.amount > 0 ? "Beat" : "Lost to"} ${other?.name ?? "someone"} on ${metric.toLowerCase()}`,
      detail: formatRange(moved.result.range),
      amount: moved.amount,
      day: moved.result.range[1],
    });
  }

  // Bounties. A hand-judged one pays once Ryan says the task was done; a
  // self-awarding one pays whoever the board says got there first, with no
  // row written anywhere — so it corrects itself like every other coin here.
  const league = { athleteIds: athletes.map((a) => a.id), activities, settings };
  for (const b of bounties) {
    const paid = bountyCoins(athleteId, b, league, refDay);
    if (!paid) continue;
    const won = b.rule ? bountyFor(b, league, refDay) : null;
    entries.push({
      kind: "bounty",
      label: b.title,
      detail: "Bounty",
      amount: paid,
      day: won?.day ?? (b.claimedAt ?? b.createdAt).slice(0, 10),
    });
  }

  // Coins handed from one man to another: one stored row, two ledger lines.
  // Never a balance edited in two places — the ledger is the truth and the
  // balance is what you get when you add it up, so the two sides cannot end up
  // disagreeing about how much moved.
  for (const t of transfers) {
    const them = athletes.find((a) => a.id === (t.fromId === athleteId ? t.toId : t.fromId));
    if (t.fromId === athleteId) {
      entries.push({
        kind: "gift",
        label: t.note || `Sent to ${them?.name ?? "someone"}`,
        detail: `To ${them?.name ?? "someone"}`,
        amount: -t.amount,
        day: t.day,
      });
    } else if (t.toId === athleteId) {
      entries.push({
        kind: "gift",
        label: t.note || `From ${them?.name ?? "someone"}`,
        detail: `From ${them?.name ?? "someone"}`,
        amount: t.amount,
        day: t.day,
      });
    }
  }

  // And what the shop took. Kept in the same ledger as a negative line, so the
  // wallet can show where the money went as well as where it came from.
  //
  // The charge follows the PAYER, not the owner. A gifted item sits in the
  // other man's locker and comes out of this man's wallet, so charging the
  // owner would bill him for a present — and leave the giver richer than he is.
  for (const p of purchases) {
    const payer = p.paidBy ?? p.athleteId;
    if (payer !== athleteId) continue;
    const them = p.paidBy && p.athleteId !== athleteId
      ? athletes.find((a) => a.id === p.athleteId)
      : null;
    // The item's NAME, not its id. "head.swimcap.cyan" in a wallet is a
    // database row showing through the floor of the app.
    const what = AVATAR_ITEM_BY_ID.get(p.itemId)?.label ?? p.itemId;
    entries.push({
      kind: them ? "gift" : "spend",
      label: them ? `${what} for ${them.name}` : what,
      detail: p.day,
      amount: -p.price,
      day: p.day,
    });
  }

  entries.sort((a, b) => (a.day === b.day ? b.amount - a.amount : b.day.localeCompare(a.day)));
  const earned = entries.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  const spent = entries.filter((e) => e.amount < 0).reduce((sum, e) => sum - e.amount, 0);
  return { balance: earned - spent, earned, spent, entries };
}

/** Everyone's balance, for the Club's rich list. */
export function coinBoard(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  refDay: DayKey = todayKey(),
  grants: CoinGrant[] = [],
  purchases: Purchase[] = [],
  bets: Bet[] = [],
  bounties: Bounty[] = [],
  transfers: Transfer[] = [],
): { athlete: Athlete; balance: number }[] {
  return athletes
    .map((athlete) => ({
      athlete,
      balance: coinAccount(athlete.id, athletes, activities, settings, refDay,
        grants, purchases, bets, bounties, transfers).balance,
    }))
    .sort((a, b) => b.balance - a.balance || a.athlete.name.localeCompare(b.athlete.name));
}

/** "1,716" — coins are whole numbers, always. */
export function fmtCoins(n: number): string {
  return Math.round(n).toLocaleString("en-CA");
}
