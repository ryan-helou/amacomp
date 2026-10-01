/**
 * Coins moving between two athletes, and items bought for somebody else.
 *
 * Ryan, 2026-10-01: "we can just transfer money or gift someone an item".
 *
 * A transfer is one stored row and two ledger lines — out of one wallet and
 * into the other — rather than a balance being edited in two places. Same rule
 * as everything else in lib/coins: the ledger is the truth and the balance is
 * what you get when you add it up, so a transfer can never leave the two sides
 * disagreeing about how much moved.
 *
 * A GIFT of an item is not a transfer of coins. It is an ordinary purchase
 * row, owned by the man who gets to wear it, with `paidBy` naming who paid —
 * so the item lands in his locker and the coins come out of the giver's
 * wallet, which is exactly what buying someone a present is.
 */
export interface Transfer {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  note: string;
  /** The day it is filed under, for the ledger's sort. */
  day: string;
}

export const TRANSFER_MIN = 1;
export const TRANSFER_MAX = 10000;
