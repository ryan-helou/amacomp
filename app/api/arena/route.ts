import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete, isAdmin } from "@/lib/session";
import { CLUB_LIVE, canSeeClub } from "@/lib/club";
import { coinAccount } from "@/lib/coins";
import {
  BET_METRIC_BY_ID, STAKE_MAX, STAKE_MIN, betRange, duplicateBet,
  type BetMetric,
} from "@/lib/bets";
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

async function balanceOf(athleteId: string, refDay: DayKey): Promise<number> {
  const store = getStore();
  const [athletes, activities, settings, grants, purchases, bets, bounties] = await Promise.all([
    store.listAthletes(), store.listActivities(), store.getSettings(),
    store.listCoinGrants(), store.listPurchases(), store.listBets(), store.listBounties(),
  ]);
  return coinAccount(athleteId, athletes, activities, settings, refDay,
    grants, purchases, bets, bounties).balance;
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
    const metric = String(body.metric ?? "") as BetMetric;
    const period = body.period === "month" ? "month" : "week";
    const stake = Math.round(Number(body.stake));
    const note = String(body.note ?? "").slice(0, 140);
    if (toId === me.id) return bad("You can't bet against yourself.");

    const athletes = await store.listAthletes();
    const them = athletes.find((a) => a.id === toId);
    if (!them) return bad("No such athlete.");
    if (!BET_METRIC_BY_ID.has(metric)) return bad("No such thing to bet on.");
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
    const clash = duplicateBet(bets, me.id, toId, metric, startsOn);
    if (clash) return bad("You two already have that one running.", 409);

    // Both sides have to be able to cover it. Checking only the proposer lets
    // a man offer a thousand coins to someone who has forty and then collect.
    const [mine, theirs] = await Promise.all([balanceOf(me.id, today), balanceOf(toId, today)]);
    if (stake > mine) return bad(`You have ${mine} coins.`);
    if (stake > theirs) return bad(`${them.name} only has ${theirs} coins.`);

    const bet = await store.addBet({ fromId: me.id, toId, metric, period, startsOn, stake, note });
    return NextResponse.json({ ok: true, bet });
  }

  if (body.action === "accept" || body.action === "decline") {
    const id = String(body.id ?? "");
    const bets = await store.listBets();
    const bet = bets.find((b) => b.id === id);
    if (!bet) return bad("No such bet.", 404);
    if (bet.toId !== me.id) return bad("That one isn't yours to answer.", 403);
    if (bet.state !== "open") return bad("That bet has already been answered.", 409);

    if (body.action === "decline") {
      const done = await store.setBetState(id, ["open"], "declined");
      return done ? NextResponse.json({ ok: true, bet: done }) : bad("Already answered.", 409);
    }

    // A window that has already closed cannot be accepted into: you would be
    // agreeing to a race that has been run.
    if (today > betRange(bet)[1]) return bad("That window has already closed.", 409);
    const [mine, theirs] = await Promise.all([
      balanceOf(me.id, today), balanceOf(bet.fromId, today),
    ]);
    if (bet.stake > mine) return bad(`You have ${mine} coins.`);
    if (bet.stake > theirs) return bad("They can't cover it any more.");

    const done = await store.setBetState(id, ["open"], "accepted");
    return done ? NextResponse.json({ ok: true, bet: done }) : bad("Already answered.", 409);
  }

  if (body.action === "cancel") {
    const id = String(body.id ?? "");
    const bet = (await store.listBets()).find((b) => b.id === id);
    if (!bet) return bad("No such bet.", 404);
    if (bet.fromId !== me.id) return bad("That isn't your offer.", 403);
    // Only while it is still an OFFER. Once it has been accepted it is a bet,
    // and a man who could pull out of a bet he was losing has not made one.
    const done = await store.setBetState(id, ["open"], "cancelled");
    return done ? NextResponse.json({ ok: true, bet: done }) : bad("Too late — it's been taken.", 409);
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
    const made = await store.addBounty({ title, detail, coins, postedBy: me.id, expiresOn });
    return NextResponse.json({ ok: true, bounty: made });
  }

  if (body.action === "claim") {
    const id = String(body.id ?? "");
    const b = (await store.listBounties()).find((x) => x.id === id);
    if (!b) return bad("No such bounty.", 404);
    if (b.expiresOn && today > b.expiresOn) return bad("That one has expired.", 409);
    // The race is this call. The store's UPDATE carries the state in its WHERE,
    // so the second man to tap gets null rather than a second claim.
    const done = await store.claimBounty(id, me.id);
    return done ? NextResponse.json({ ok: true, bounty: done }) : bad("Somebody got there first.", 409);
  }

  if (body.action === "award" || body.action === "reject" || body.action === "void") {
    if (!isAdmin(me)) return bad("Only Ryan settles bounties.", 403);
    const id = String(body.id ?? "");
    const to = body.action === "award" ? "paid" : body.action === "void" ? "void" : "open";
    const from = body.action === "void" ? ["open" as const, "claimed" as const] : ["claimed" as const];
    const done = await store.setBountyState(id, from, to);
    return done ? NextResponse.json({ ok: true, bounty: done }) : bad("Nothing to do there.", 409);
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
