import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete, isAdmin } from "@/lib/session";
import { readState } from "@/lib/state";
import { canSeeClub } from "@/lib/club";
import { coinAccount } from "@/lib/coins";
import { AVATAR_ITEM_BY_ID } from "@/lib/pixelAvatar";

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
  if (!canSeeClub(me.name)) return new NextResponse("Not found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    buy?: unknown;
    wear?: unknown;
    grant?: unknown;
  };
  const store = getStore();

  if (typeof body.buy === "string") {
    const item = AVATAR_ITEM_BY_ID.get(body.buy);
    if (!item) return NextResponse.json({ error: "No such item." }, { status: 400 });
    if (item.earned) {
      return NextResponse.json({ error: `${item.label} is won, not sold.` }, { status: 400 });
    }

    // The price comes from the catalogue, never from the request — otherwise
    // the buyer names their own price.
    const [athletes, activities, settings, grants, purchases] = await Promise.all([
      store.listAthletes(),
      store.listActivities(),
      store.getSettings(),
      store.listCoinGrants(),
      store.listPurchases(),
    ]);

    if (purchases.some((p) => p.athleteId === me.id && p.itemId === item.id)) {
      return NextResponse.json({ error: `You already own ${item.label}.` }, { status: 409 });
    }

    const { balance } = coinAccount(me.id, athletes, activities, settings, undefined, grants, purchases);
    if (item.price > balance) {
      return NextResponse.json(
        { error: `${item.label} costs ${item.price}. You have ${balance}.` },
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
    const mine = new Set((await store.listPurchases()).filter((p) => p.athleteId === me.id).map((p) => p.itemId));
    const clean: Record<string, { item: string }> = {};
    for (const [slot, worn] of Object.entries(loadout)) {
      if (typeof worn?.item !== "string") continue;
      const item = AVATAR_ITEM_BY_ID.get(worn.item);
      if (!item) continue;
      // Free kit is everyone's. A prize is nobody's until it's won, and
      // winning isn't wired up yet, so it can't be saved either.
      const owned = mine.has(item.id) || (item.price === 0 && !item.earned);
      if (!owned) continue;
      clean[slot] = { item: item.id };
    }
    await store.setLoadout(me.id, clean);
    return NextResponse.json(await readState());
  }

  return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
}
