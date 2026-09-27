/**
 * The Club — tri coins, the shop, bets and challenges.
 *
 * Coins are a parallel currency: one coin per AmaComp point, plus bonuses for
 * winning things. They buy cosmetics and settle side bets, and they NEVER touch
 * a score — the week, month and season are decided by points alone.
 *
 * ## Live where?
 *
 * The whole thing runs on `npm run dev` and shows as "coming soon" on the
 * deployed app, so it can be built and played with end to end before the lads
 * ever see it. Ryan's call, 2026-09-26. Flipping it on for everyone is one
 * environment variable — `NEXT_PUBLIC_CLUB_LIVE=1` on the Railway service — and
 * no code change, so the switch can be thrown the moment it's ready.
 */
const CLUB_FLAG = process.env.NEXT_PUBLIC_CLUB_LIVE;
export const CLUB_LIVE =
  // "0" forces the teaser, which is how the deployed view is checked locally.
  CLUB_FLAG === "1" ? true : CLUB_FLAG === "0" ? false : process.env.NODE_ENV === "development";

/** What a coin is called, singular and plural, in one place. */
export const COIN = { one: "tri coin", many: "tri coins", short: "TC" } as const;

/** The three rooms of the Club. */
export type ClubRoom = "shop" | "bets" | "challenges";

export const CLUB_ROOMS: { id: ClubRoom; label: string; blurb: string }[] = [
  {
    id: "shop",
    label: "Shop",
    blurb: "Spend coins on frames, flags, lane colours and a title under your name.",
  },
  {
    id: "bets",
    label: "Bets",
    blurb: "Stake coins head to head. Both sides have to accept, and the app settles it.",
  },
  {
    id: "challenges",
    label: "Challenges",
    blurb: "Bounties Ryan posts. First to do the thing takes the coins.",
  },
];
