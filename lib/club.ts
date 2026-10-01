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
 * Who gets the Club early.
 *
 * Ryan's call, 2026-09-29: the club goes on the real app, and the name on the
 * door decides. Matched exactly, for the same reason the trips are (lib/away.ts):
 * Jona and Jonah are two different people.
 *
 * Understand what this is and isn't. Signing in here is a name and nothing
 * else (lib/session.ts says so), so this stops the lads STUMBLING into
 * unfinished work — it does not stop anyone who types Ryan's name, and the
 * shop's item names sit in a chunk any browser can fetch. That's a trade Ryan
 * made knowingly: five mates, not five attackers.
 */
export function canSeeClub(name: string | null | undefined): boolean {
  return name === "Ryan";
}

/**
 * TEST MODE: pretend the viewer already won a season.
 *
 * Nothing in the app has ever shown the champion treatment, because no season
 * has finished — the crown, the gold edge and the podium circlets are all
 * drawn off `reigningChampionId`, which is null until a season actually
 * closes. Ryan asked to see it on his phone before then, so while there is no
 * real champion, and ONLY on his own device, he is treated as one.
 *
 * Three things keep this honest:
 *
 *  * It is per-viewer. Everyone else's app is untouched — nobody is shown a
 *    champion who hasn't won anything, which would be a lie about the league
 *    rather than a preview.
 *  * It self-expires. The moment a season really closes, `real` is non-null
 *    and the real answer wins; this never overrides a genuine result.
 *  * It is one function with a test, not a condition sprinkled through the
 *    components, so turning it off is deleting TEST_CHAMPION and this block.
 *
 * Ryan, 2026-10-01: "act like i won season 0".
 */
export const TEST_CHAMPION = true;

export function championWithTestMode(
  real: string | null,
  me: { id: string; name: string | null } | null | undefined,
): string | null {
  if (real) return real;
  if (!TEST_CHAMPION || !me || !canSeeClub(me.name)) return real;
  return me.id;
}

/** What a coin is called, singular and plural, in one place. */
export const COIN = { one: "tri coin", many: "tri coins", short: "TC" } as const;

/**
 * The rooms of the Club, in two houses.
 *
 * Ryan, 2026-09-30: split the Club in two. Everything about YOU — what you
 * have, what you buy, what you look like — is one tab; everything you do
 * AGAINST somebody else is the other. Four rooms behind one label had the
 * wallet and a head-to-head bet sharing a row of tabs, which is two different
 * frames of mind.
 */
export type ClubRoom = "wallet" | "shop" | "profile" | "bets" | "bounties";
export type ClubHouse = "club" | "arena";

export const CLUB_ROOMS: { id: ClubRoom; house: ClubHouse; label: string; blurb: string }[] = [
  {
    id: "wallet",
    house: "club",
    label: "Wallet",
    blurb: "What you've earned, and where every coin came from.",
  },
  {
    id: "shop",
    house: "club",
    label: "Shop",
    blurb: "Spend coins on frames, flags, lane colours and a title under your name.",
  },
  {
    id: "profile",
    house: "club",
    label: "Profile",
    blurb: "Your figure, front and back, and the flag you fly.",
  },
  {
    id: "bets",
    house: "arena",
    label: "Bets",
    blurb: "Stake coins head to head. Both sides have to accept, and the app settles it.",
  },
  {
    id: "bounties",
    house: "arena",
    label: "Bounties",
    blurb: "Tasks Ryan posts with coins attached. First to do it takes them.",
  },
];

/** The rooms of one house, in order. */
export const roomsOf = (house: ClubHouse) => CLUB_ROOMS.filter((r) => r.house === house);
