import type { DayKey } from "./dates";
import type { Activity, Settings } from "./types";
import { bountyWinner, parseRule, type BountyRule } from "./bountyRules";

/**
 * Bounties — a task with coins on it, first man to do it takes them.
 *
 * The opposite design to a bet, and deliberately. A bet is settled by the
 * board because no human is trusted to settle one; a bounty is settled by
 * Ryan because the whole point of a bounty is that it can ask for things the
 * board cannot see — "swim at the lake", "drag Jonah out on a Sunday", "ride
 * in the rain". Pinning bounties to measurable targets would have made them a
 * second, worse kind of bet.
 *
 * So the flow is: posted (admin) → claimed (anyone, first wins) → paid or sent
 * back. "First to do it" is enforced by the claim, not by the payout: once
 * somebody has claimed it the board stops offering it, so two men don't both
 * go and ride 50km for the same hundred coins.
 *
 * Ryan, 2026-10-05: "for bounties it should be automatic given to someone."
 * A bounty may now carry a RULE, and one that does skips the whole flow above
 * — see lib/bountyRules. Nobody claims it, nobody confirms it, and the winner
 * is derived from the board the same way a bet's is. The hand-judged flow
 * stays for the bounties no rule can describe.
 */

export type BountyState = "open" | "claimed" | "paid" | "void";

export interface Bounty {
  id: string;
  title: string;
  detail: string;
  coins: number;
  state: BountyState;
  /** Who posted it. Admin only — the API enforces that, not this file. */
  postedBy: string;
  /** Who got there first. Null while it is still open. */
  claimedBy: string | null;
  claimedAt: string | null;
  /** The day it stops being claimable. Null means it stands until taken. */
  expiresOn: DayKey | null;
  /**
   * How the board decides this one by itself. Null means it is judged by hand
   * — the original flow, for the things the board cannot see.
   */
  rule: BountyRule | null;
  createdAt: string;
}

export const BOUNTY_MIN = 10;
export const BOUNTY_MAX = 5000;

/**
 * Whether this bounty is still there to be taken, on this day.
 *
 * A self-awarding bounty is open until somebody satisfies it; after that it is
 * won, and the board must stop offering it even though no row ever changed.
 * That is why this takes the league with it — the answer is derived, not read.
 */
export function isOpen(
  b: Bounty,
  today: DayKey,
  league?: { athleteIds: string[]; activities: Activity[]; settings: Settings },
): boolean {
  if (b.state !== "open") return false;
  if (b.expiresOn && today > b.expiresOn) return false;
  if (b.rule && league && bountyFor(b, league, today)) return false;
  return true;
}

/** Who the board says has won a self-awarding bounty, if anyone has. */
export function bountyFor(
  b: Bounty,
  league: { athleteIds: string[]; activities: Activity[]; settings: Settings },
  today: DayKey,
): { athleteId: string; day: DayKey } | null {
  const rule = parseRule(b.rule);
  if (!rule) return null;
  const from = b.createdAt.slice(0, 10) as DayKey;
  // Expiry caps the window: a rule met the week after it lapsed is not a win.
  const until = b.expiresOn && b.expiresOn < today ? b.expiresOn : today;
  return bountyWinner(rule, league.athleteIds, league.activities, league.settings, from, until);
}

/**
 * The board, in the order a man wants to read it: what he can still take, then
 * what is being judged, then what has been paid out.
 *
 * Expired bounties sort with the dead ones rather than vanishing — a bounty
 * that quietly disappears looks like a bug to whoever was halfway through it.
 */
export function sortBounties(
  bounties: Bounty[],
  today: DayKey,
  league?: { athleteIds: string[]; activities: Activity[]; settings: Settings },
): Bounty[] {
  const rank = (b: Bounty) =>
    isOpen(b, today, league) ? 0 : b.state === "claimed" ? 1 : b.state === "paid" ? 2 : 3;
  return [...bounties].sort(
    (a, b) => rank(a) - rank(b) || (a.createdAt < b.createdAt ? 1 : -1),
  );
}

/**
 * The coins a bounty has paid this athlete.
 *
 * A hand-judged bounty pays when Ryan says it is paid. A self-awarding one
 * pays the man the board picked, with no row written anywhere — so striking
 * off the session that won it takes the coins back with it, which is the same
 * rule every other coin in the app follows.
 */
export function bountyCoins(
  athleteId: string,
  b: Bounty,
  league?: { athleteIds: string[]; activities: Activity[]; settings: Settings },
  today?: DayKey,
): number {
  if (b.rule && league && today) {
    const won = bountyFor(b, league, today);
    return won && won.athleteId === athleteId ? b.coins : 0;
  }
  return b.state === "paid" && b.claimedBy === athleteId ? b.coins : 0;
}
