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

/**
 * Who can see the avatar preview.
 *
 * It used to be `name === "Ryan"`, which was no lock at all: signing in is a
 * name and nothing else (lib/session.ts says so in as many words), so anyone
 * who typed Ryan's name saw the shop. Now the server decides, from a key only
 * Ryan has, and hands the client a plain yes or no — the client can't grant
 * itself anything it wasn't given.
 */
export function canPreviewAvatar(granted: boolean | undefined): boolean {
  return granted === true;
}

/**
 * Does this key open the preview?
 *
 * Compared in constant time, and a short or missing key on the server opens
 * nothing — otherwise forgetting to set the variable would leave the door wide
 * open with an empty key, which is the worst kind of default.
 */
export function keyAccepted(given: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || expected.length < 16) return false;
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** What a coin is called, singular and plural, in one place. */
export const COIN = { one: "tri coin", many: "tri coins", short: "TC" } as const;

/** The rooms of the Club. The wallet is first because it's the one you check. */
export type ClubRoom = "wallet" | "shop" | "bets" | "bounties";

export const CLUB_ROOMS: { id: ClubRoom; label: string; blurb: string }[] = [
  {
    id: "wallet",
    label: "Wallet",
    blurb: "What you've earned, and where every coin came from.",
  },
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
    id: "bounties",
    label: "Bounties",
    blurb: "Tasks Ryan posts with coins attached. First to do it takes them.",
  },
];
