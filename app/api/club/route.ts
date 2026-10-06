import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete, isAdmin } from "@/lib/session";
import { readState } from "@/lib/state";
import { CLUB_LIVE, canSeeClub } from "@/lib/club";
import { freeCoins } from "@/lib/coins";
import { AVATAR_ITEM_BY_ID, STARTER_ITEMS } from "@/lib/pixelAvatar";
import { earnedPrizes } from "@/lib/prizes";
import { leagueToday } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * The Club's till.
 *
 * Two things happen here: buying something, and saving what you're wearing.
 * Both are POSTs from the signed-in athlete for themselves — there is no path
 * to spend somebody else's coins, because the athlete is read from the session
 * cookie and never from the body.
 */
export async function POST(req: Request) {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  // The same door as the Club's rooms, the Arena's API and the tab shape:
  // Ryan always, the league once CLUB_LIVE is on. It used to be Ryan alone,
  // which would have given everyone else a shop they could look at and not
  // buy from the moment the switch was thrown.
  if (!CLUB_LIVE && !canSeeClub(me.name)) return new NextResponse("Not found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    buy?: unknown;
    wear?: unknown;
    grant?: unknown;
  };
  const store = getStore();

  if (typeof body.buy === "string") {
    const item = AVATAR_ITEM_BY_ID.get(body.buy);
    if (!item) return NextResponse.json({ error: "No such item." }, { status: 400 });
    // A prize is won, not sold. It has no price to charge, so there is nothing
    // here to do but say so — otherwise a free row lands in the ledger and the
    // shelf stops meaning anything.
    if (item.earned) {
      return NextResponse.json(
        { error: `${item.label} isn't for sale — ${item.earned}.` },
        { status: 403 },
      );
    }
    // The price comes from the catalogue, never from the request — otherwise
    // the buyer names their own price.
    // Bets and bounties are in here too: a man who lost a hundred coins on
    // Sunday must not be able to spend them on Monday because the till was
    // only counting sessions and the shop.
    const [athletes, activities, settings, grants, purchases, bets, bounties] = await Promise.all([
      store.listAthletes(),
      store.listActivities(),
      store.getSettings(),
      store.listCoinGrants(),
      store.listPurchases(),
      store.listBets(),
      store.listBounties(),
    ]);

    if (purchases.some((p) => p.athleteId === me.id && p.itemId === item.id)) {
      return NextResponse.json({ error: `You already own ${item.label}.` }, { status: 409 });
    }

    // Coins riding on unfinished bets aren't his to spend (lib/coins freeCoins),
    // and coins sent and received count — they used to be left out here.
    const transfers = await store.listTransfers();
    const { free, staked } = freeCoins(me.id, athletes, activities, settings, undefined,
      grants, purchases, bets, bounties, transfers);
    if (item.price > free) {
      const f = Math.max(free, 0);
      return NextResponse.json(
        { error: staked > 0
          ? `${item.label} costs ${item.price}. You have ${f} free — ${staked} more ${staked === 1 ? "is" : "are"} riding on bets that haven't finished.`
          : `${item.label} costs ${item.price}. You have ${f}.` },
        { status: 402 },
      );
    }

    const bought = await store.addPurchase(me.id, item.id, item.price);
    // Null means the row was already there — two taps racing each other. The
    // primary key settled it, and the answer to the loser is the same as the
    // answer to anyone who already owns it.
    if (!bought) {
      return NextResponse.json({ error: `You already own ${item.label}.` }, { status: 409 });
    }
    return NextResponse.json(await readState());
  }

  /**
   * Coins handed out by an admin: a test float now, bounties and settled bets
   * later. It's the one way coins enter without being earned, so it's admin
   * only and it leaves a line in the wallet saying where they came from.
   */
  if (body.grant && typeof body.grant === "object") {
    if (!isAdmin(me)) return NextResponse.json({ error: "Admins only." }, { status: 403 });
    const g = body.grant as { athlete?: unknown; amount?: unknown; note?: unknown };
    const amount = Math.round(Number(g.amount));
    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ error: "How many coins?" }, { status: 400 });
    }
    const who = typeof g.athlete === "string" ? g.athlete : me.name;
    const athletes = await store.listAthletes();
    // Matched exactly: Jona and Jonah are two different people.
    const target = athletes.find((a) => a.name === who);
    if (!target) return NextResponse.json({ error: `No athlete called ${who}.` }, { status: 404 });
    await store.addCoinGrant(target.id, amount, typeof g.note === "string" ? g.note : "Granted");
    return NextResponse.json(await readState());
  }

  if (body.wear && typeof body.wear === "object") {
    const loadout = body.wear as Record<string, { item?: unknown }>;
    // You can try anything on in the shop; you can only SAVE what's yours.
    // Otherwise the locker is a fitting room and the board is a lie.
    //
    // Ryan used to be exempt — the run of the shelf while the Club was his
    // alone (2026-09-26). The Club is everyone's now, and he asked on
    // 2026-10-05 to own nothing he hadn't earned, so the exemption is gone.
    //
    // A trophy is free, but it is not free KIT: it is a result, and it is
    // only yours if lib/prizes says you earned it.
    const mine = new Set((await store.listPurchases()).filter((p) => p.athleteId === me.id).map((p) => p.itemId));
    const [athletes, activities, settings] = await Promise.all([
      store.listAthletes(), store.listActivities(), store.getSettings(),
    ]);
    const won = earnedPrizes(me.id, athletes, activities, settings, leagueToday());
    const clean: Record<string, { item: string }> = {};
    const dropped: string[] = [];
    for (const [slot, worn] of Object.entries(loadout)) {
      if (typeof worn?.item !== "string") continue;
      const item = AVATAR_ITEM_BY_ID.get(worn.item);
      if (!item) continue;
      // The starter kit is his whether or not it has a price. The white
      // running shoes cost 600 on the shelf and come with every account, and
      // checking "free or bought" alone refused every save that had them on —
      // which, until a man bought new shoes, was every save.
      const yours = item.slot === "prize"
        ? won.has(item.id)
        : item.price === 0 || STARTER_ITEMS.has(item.id) || mine.has(item.id);
      if (!yours) {
        dropped.push(item.label);
        continue;
      }
      clean[slot] = { item: item.id };
    }
    // Say so rather than swallowing it. A save that silently keeps half of
    // what you picked is worse than one that refuses.
    if (dropped.length > 0) {
      return NextResponse.json(
        { error: `Not yours yet: ${dropped.join(", ")}.` },
        { status: 402 },
      );
    }
    await store.setLoadout(me.id, clean);
    return NextResponse.json(await readState());
  }

  return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
}
