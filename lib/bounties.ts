import type { DayKey } from "./dates";

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
  createdAt: string;
}

export const BOUNTY_MIN = 10;
export const BOUNTY_MAX = 5000;

/** Whether this bounty is still there to be taken, on this day. */
export function isOpen(b: Bounty, today: DayKey): boolean {
  if (b.state !== "open") return false;
  return !b.expiresOn || today <= b.expiresOn;
}

/**
 * The board, in the order a man wants to read it: what he can still take, then
 * what is being judged, then what has been paid out.
 *
 * Expired bounties sort with the dead ones rather than vanishing — a bounty
 * that quietly disappears looks like a bug to whoever was halfway through it.
 */
export function sortBounties(bounties: Bounty[], today: DayKey): Bounty[] {
  const rank = (b: Bounty) =>
    isOpen(b, today) ? 0 : b.state === "claimed" ? 1 : b.state === "paid" ? 2 : 3;
  return [...bounties].sort(
    (a, b) => rank(a) - rank(b) || (a.createdAt < b.createdAt ? 1 : -1),
  );
}

/** The coins a bounty has actually paid this athlete. Unpaid pays nothing. */
export function bountyCoins(athleteId: string, b: Bounty): number {
  return b.state === "paid" && b.claimedBy === athleteId ? b.coins : 0;
}
