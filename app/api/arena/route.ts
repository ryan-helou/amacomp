import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete, isAdmin } from "@/lib/session";
import { CLUB_LIVE, canSeeClub } from "@/lib/club";
import { freeCoins } from "@/lib/coins";
import { readState } from "@/lib/state";
import {
  BET_METRIC_BY_ID, PUSH, STAKE_MAX, STAKE_MIN, betRange, duplicateBet,
  type BetMetric, ANYONE, isOpenToAll,
} from "@/lib/bets";
import { TRANSFER_MAX, TRANSFER_MIN } from "@/lib/transfers";
import { AVATAR_ITEM_BY_ID } from "@/lib/pixelAvatar";
import { parseRule } from "@/lib/bountyRules";
import { BOUNTY_MAX, BOUNTY_MIN } from "@/lib/bounties";
import { monthStart, today as todayKey, weekStart, type DayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * The Arena: bets proposed, accepted and declined, and bounties posted,
 * claimed and paid.
 *
 * Who you are is read from the session cookie and NEVER from the body, the
 * same rule the till follows (app/api/club). Everything here moves somebody's
 * coins, so every action re-derives the balances it is about to rely on rather
 * than trusting a number the client sent up.
 *
 * Nothing here settles a bet. Settlement is derived from the log at read time
 * (lib/bets.ts) — there is no endpoint that can pay one out, which is the
 * point: a bet nobody can reach in to decide is a bet nobody argues about.
 */

const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

/**
 * Every success answers with the WHOLE state, and that is not a style choice.
 *
 * useLeague's `send` swaps whatever an endpoint returns straight into the app
 * state (components/useLeague.ts), so a route that answers `{ok: true}` hands
 * the app an object with no athletes in it and the screen goes blank. Ryan
 * found it on the first gift. One helper, so the next action added here cannot
 * get it wrong — the only thing a caller chooses is whether it failed.
 */
const ok = async () => NextResponse.json(await readState());

/**
 * What a man can put on the line: his balance less what's already riding on
 * unfinished bets (lib/coins freeCoins). `exceptId` keeps the bet being
 * accepted from counting against itself.
 */
async function balanceOf(athleteId: string, refDay: DayKey, exceptId?: string): Promise<number> {
  return (await coinsOf(athleteId, refDay, exceptId)).free;
}

/** The same, with what's staked, so a refusal can say WHY he's short. */
async function coinsOf(athleteId: string, refDay: DayKey, exceptId?: string) {
  const store = getStore();
  const [athletes, activities, settings, grants, purchases, bets, bounties, transfers] =
    await Promise.all([
      store.listAthletes(), store.listActivities(), store.getSettings(),
      store.listCoinGrants(), store.listPurchases(), store.listBets(), store.listBounties(),
      store.listTransfers(),
    ]);
  return freeCoins(athleteId, athletes, activities, settings, refDay,
    grants, purchases, bets, bounties, transfers, exceptId);
}

/** "You have 40 coins free" — and why, when bets are the reason. */
function short(free: number, staked: number): string {
  const f = Math.max(free, 0);
  return staked > 0
    ? `You have ${f} coins free — ${staked} more ${staked === 1 ? "is" : "are"} riding on bets that haven't finished.`
    : `You have ${f} coins.`;
}

export async function POST(req: Request) {
  const me = await currentAthlete();
  if (!me) return bad("Sign in first.", 401);
  // The same door the Club's own UI uses (components/ClubTab): Ryan always,
  // everyone else once CLUB_LIVE is on. It has to be this rather than Ryan
  // alone, because a bet has two sides — a door only he can walk through is a
  // bet nobody can ever accept.
  if (!CLUB_LIVE && !canSeeClub(me.name)) return new NextResponse("Not found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const store = getStore();
  const today = todayKey();

  // ---- Bets -------------------------------------------------------------

  if (body.action === "propose") {
    const toId = String(body.toId ?? "");
    // Ryan, 2026-10-01: "the guys are all trust worthy so you dont have to put
    // a measurable thing". A word bet carries its terms as text and is settled
    // by the two of them; the metric and the window are still stored, because
    // a word bet made for "this week" should still say which week it was.
    const kind = body.kind === "word" ? "word" : "board";
    const terms = String(body.terms ?? "").trim().slice(0, 200);
    const metric = (kind === "word" ? "points" : String(body.metric ?? "")) as BetMetric;
    const period = body.period === "month" ? "month" : "week";
    const stake = Math.round(Number(body.stake));
    const note = String(body.note ?? "").slice(0, 140);
    if (toId === me.id) return bad("You can't bet against yourself.");
    // "anyone" is an offer to the whole league; the first to take it is the
    // other side (lib/bets ANYONE).
    const open = toId === ANYONE || toId === "anyone";

    const athletes = await store.listAthletes();
    const them = open ? null : athletes.find((a) => a.id === toId);
    if (!open && !them) return bad("No such athlete.");
    if (!BET_METRIC_BY_ID.has(metric)) return bad("No such thing to bet on.");
    if (kind === "word" && !terms) return bad("Say what the bet is.");
    if (!Number.isFinite(stake) || stake < STAKE_MIN || stake > STAKE_MAX) {
      return bad(`A stake is between ${STAKE_MIN} and ${STAKE_MAX} coins.`);
    }

    // "Next" is offered as well as "this", because a bet proposed on a Sunday
    // night about the week that is ending is not a bet, it is a result.
    const base = body.when === "next"
      ? (period === "week" ? addWeek(today) : addMonth(today))
      : today;
    const startsOn = period === "week" ? weekStart(base) : monthStart(base);

    const bets = await store.listBets();
    const target = open ? ANYONE : toId;
    const clash = duplicateBet(bets, me.id, target, metric, startsOn);
    if (clash) {
      return bad(open ? "You already have that one up for anyone." : "You two already have that one running.", 409);
    }

    // Both sides have to be able to cover it. Checking only the proposer lets
    // a man offer a thousand coins to someone who has forty and then collect.
    // An open offer has no other side yet — the taker is checked when he takes it.
    const mineC = await coinsOf(me.id, today);
    if (stake > mineC.free) return bad(short(mineC.free, mineC.staked));
    if (them) {
      const theirs = await balanceOf(toId, today);
      if (stake > theirs) return bad(`${them.name} only has ${Math.max(theirs, 0)} coins free.`);
    }

    await store.addBet({ fromId: me.id, toId: target, kind, terms, metric, period, startsOn, stake, note });
    return ok();
  }

  if (body.action === "accept" || body.action === "decline") {
    const id = String(body.id ?? "");
    const bets = await store.listBets();
    const bet = bets.find((b) => b.id === id);
    if (!bet) return bad("No such bet.", 404);
    const forAnyone = isOpenToAll(bet);
    if (!forAnyone && bet.toId !== me.id) return bad("That one isn't yours to answer.", 403);
    if (forAnyone && bet.fromId === me.id) return bad("You can't take your own bet.");
    if (bet.state !== "open") return bad("That bet has already been answered.", 409);

    // Nobody declines an open offer — there is nobody to decline it on behalf
    // of. You leave it for someone else; the man who made it can pull it.
    if (body.action === "decline" && forAnyone) return bad("Leave it for someone else — it's open to anyone.");

    if (body.action === "decline") {
      const done = await store.setBetState(id, ["open"], "declined");
      return done ? ok() : bad("Already answered.", 409);
    }

    // A window that has already closed cannot be accepted into: you would be
    // agreeing to a race that has been run.
    if (today > betRange(bet)[1]) return bad("That window has already closed.", 409);
    const [mine, theirs] = await Promise.all([
      balanceOf(me.id, today, id), balanceOf(bet.fromId, today, id),
    ]);
    if (bet.stake > mine) {
      const c = await coinsOf(me.id, today, id);
      return bad(`You can't cover ${bet.stake}. ${short(c.free, c.staked)}`);
    }
    if (bet.stake > theirs) return bad("They can't cover it any more.");

    if (forAnyone) {
      const taken = await store.takeBet(id, me.id);
      return taken ? ok() : bad("Someone got there first.", 409);
    }
    const done = await store.setBetState(id, ["open"], "accepted");
    return done ? ok() : bad("Already answered.", 409);
  }

  if (body.action === "cancel") {
    const id = String(body.id ?? "");
    const bet = (await store.listBets()).find((b) => b.id === id);
    if (!bet) return bad("No such bet.", 404);
    if (bet.fromId !== me.id) return bad("That isn't your offer.", 403);
    // Only while it is still an OFFER. Once it has been accepted it is a bet,
    // and a man who could pull out of a bet he was losing has not made one.
    const done = await store.setBetState(id, ["open"], "cancelled");
    return done ? ok() : bad("Too late — it's been taken.", 409);
  }

  // ---- Word bets: called by one, confirmed by the other -----------------

  if (body.action === "call") {
    const id = String(body.id ?? "");
    const winner = String(body.winner ?? "");
    const bet = (await store.listBets()).find((b) => b.id === id);
    if (!bet) return bad("No such bet.", 404);
    if (bet.kind !== "word") return bad("That one settles itself off the board.", 409);
    if (bet.fromId !== me.id && bet.toId !== me.id) return bad("You're not in that bet.", 403);
    if (bet.state !== "accepted") return bad("That bet isn't running.", 409);
    if (winner !== PUSH && winner !== bet.fromId && winner !== bet.toId) {
      return bad("The winner has to be one of you, or a draw.");
    }
    const done = await store.callBet(id, me.id, winner);
    return done ? ok() : bad("Already called.", 409);
  }

  if (body.action === "confirm" || body.action === "dispute") {
    const id = String(body.id ?? "");
    const bet = (await store.listBets()).find((b) => b.id === id);
    if (!bet) return bad("No such bet.", 404);
    if (bet.kind !== "word") return bad("That one settles itself off the board.", 409);
    if (!bet.calledBy || !bet.calledWinner) return bad("Nobody has called it yet.", 409);
    // The man who called it can NEVER confirm it, and that includes Ryan.
    // Being the admin is what lets him settle other people's arguments; it
    // must not let him settle his own, or every word bet he is in is one he
    // can win by tapping twice. A bet the two of them genuinely cannot agree
    // on simply never pays — the stake stays where it is, which is a far
    // better answer than the admin always winning.
    if (bet.calledBy === me.id) return bad("The other one has to agree.", 403);
    const party = bet.fromId === me.id || bet.toId === me.id;
    if (!party && !isAdmin(me)) return bad("You're not in that bet.", 403);
    if (body.action === "dispute") {
      const done = await store.clearBetCall(id);
      return done ? ok() : bad("Nothing to dispute.", 409);
    }
    const done = await store.settleBet(id, bet.calledWinner);
    return done ? ok() : bad("Already settled.", 409);
  }

  // ---- Coins and presents ------------------------------------------------

  if (body.action === "send") {
    const toId = String(body.toId ?? "");
    const amount = Math.round(Number(body.amount));
    const note = String(body.note ?? "").trim().slice(0, 140);
    if (toId === me.id) return bad("Sending coins to yourself achieves nothing.");
    const them = (await store.listAthletes()).find((a) => a.id === toId);
    if (!them) return bad("No such athlete.");
    if (!Number.isFinite(amount) || amount < TRANSFER_MIN || amount > TRANSFER_MAX) {
      return bad(`Send between ${TRANSFER_MIN} and ${TRANSFER_MAX} coins.`);
    }
    const mineC = await coinsOf(me.id, today);
    if (amount > mineC.free) return bad(short(mineC.free, mineC.staked));
    await store.addTransfer(me.id, toId, amount, note);
    return ok();
  }

  if (body.action === "gift") {
    const toId = String(body.toId ?? "");
    const item = AVATAR_ITEM_BY_ID.get(String(body.item ?? ""));
    if (!item) return bad("No such item.");
    // A prize is won, not sold, so it cannot be bought for somebody either —
    // a crown you were given is not a crown.
    if (item.earned) return bad(`${item.label} isn't for sale — ${item.earned}.`);
    const them = (await store.listAthletes()).find((a) => a.id === toId);
    if (!them) return bad("No such athlete.");
    if (toId === me.id) return bad("That's just buying it.");

    const purchases = await store.listPurchases();
    if (purchases.some((p) => p.athleteId === toId && p.itemId === item.id)) {
      return bad(`${them.name} already owns ${item.label}.`, 409);
    }
    // The price comes from the catalogue, never from the request.
    const mineC = await coinsOf(me.id, today);
    if (item.price > mineC.free) return bad(`${item.label} costs ${item.price}. ${short(mineC.free, mineC.staked)}`);

    const bought = await store.addPurchase(toId, item.id, item.price, me.id);
    if (!bought) return bad(`${them.name} already owns ${item.label}.`, 409);
    return ok();
  }

  // ---- Bounties ---------------------------------------------------------

  if (body.action === "post") {
    if (!isAdmin(me)) return bad("Only Ryan posts bounties.", 403);
    const title = String(body.title ?? "").trim().slice(0, 80);
    const detail = String(body.detail ?? "").trim().slice(0, 400);
    const coins = Math.round(Number(body.coins));
    const expiresOn = body.expiresOn ? String(body.expiresOn) : null;
    if (!title) return bad("Give it a title.");
    if (!Number.isFinite(coins) || coins < BOUNTY_MIN || coins > BOUNTY_MAX) {
      return bad(`A bounty is between ${BOUNTY_MIN} and ${BOUNTY_MAX} coins.`);
    }
    // A rule makes it self-awarding; without one it stays hand-judged.
    const rule = parseRule(body.rule);
    await store.addBounty({ title, detail, coins, postedBy: me.id, expiresOn, rule });
    return ok();
  }

  if (body.action === "claim") {
    const id = String(body.id ?? "");
    const b = (await store.listBounties()).find((x) => x.id === id);
    if (!b) return bad("No such bounty.", 404);
    if (b.expiresOn && today > b.expiresOn) return bad("That one has expired.", 409);
    // Nobody claims a bounty the board settles. Letting a claim through would
    // put a second, quieter answer beside the derived one.
    if (b.rule) return bad("That one settles itself — the board awards it.", 409);
    // The race is this call. The store's UPDATE carries the state in its WHERE,
    // so the second man to tap gets null rather than a second claim.
    const done = await store.claimBounty(id, me.id);
    return done ? ok() : bad("Somebody got there first.", 409);
  }

  if (body.action === "award" || body.action === "reject" || body.action === "void") {
    if (!isAdmin(me)) return bad("Only Ryan settles bounties.", 403);
    const id = String(body.id ?? "");
    const to = body.action === "award" ? "paid" : body.action === "void" ? "void" : "open";
    const from = body.action === "void" ? ["open" as const, "claimed" as const] : ["claimed" as const];
    const done = await store.setBountyState(id, from, to);
    return done ? ok() : bad("Nothing to do there.", 409);
  }

  return bad("Unknown action.");
}

/** The same day next week / next month, for a bet made in advance. */
function addWeek(day: DayKey): DayKey {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10) as DayKey;
}
function addMonth(day: DayKey): DayKey {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  return d.toISOString().slice(0, 10) as DayKey;
}
