/**
 * The Arena from a terminal.
 *
 *   npx tsx scripts/arena.ts bounties
 *   npx tsx scripts/arena.ts bounty "Swim at the lake" 300 --detail "Photo or it didn't happen" --until 2026-10-31
 *   npx tsx scripts/arena.ts award <id>        (also: claim, reject, void)
 *   npx tsx scripts/arena.ts bets
 *   npx tsx scripts/arena.ts bet Jona points 150 --month --next --note "easy money"
 *   npx tsx scripts/arena.ts accept <id>       (also: decline, cancel)
 *
 * Ryan, 2026-10-01: bounties have to be postable from his phone AND from here.
 * The phone has the Arena tab; this is the other half.
 *
 * It goes through the SAME HTTP API the app uses rather than reaching into the
 * database, and that is the whole design of the thing. Every rule that protects
 * a bet — both sides can cover the stake, no duplicate, no cancelling one you
 * have already lost, only Ryan pays a bounty — lives in app/api/arena. A script
 * writing rows directly would be a second, quieter set of rules that nobody
 * remembers to keep in step, and the first bug would be a bounty paid twice.
 *
 * Signing in is a name, exactly as it is in the app (lib/session.ts): this
 * posts to /api/session and keeps the cookie. So it can do precisely what Ryan
 * can do on his phone, and nothing more.
 *
 *   AMAGOH_URL   defaults to the live app; point it at http://localhost:3000
 *                to play with it against a throwaway in-memory server.
 *   AMAGOH_NAME  defaults to Ryan.
 */
import { BET_METRIC_BY_ID, betResult, betWhen, type Bet, type BetMetric } from "../lib/bets";
import { sortBounties, type Bounty } from "../lib/bounties";
import { today as todayKey } from "../lib/dates";
import type { Athlete } from "../lib/types";

const URL_BASE = process.env.AMAGOH_URL ?? "https://amagohtrain-production.up.railway.app";
const NAME = process.env.AMAGOH_NAME ?? "Ryan";

let cookie = "";

// `arena.ts bounties | head -1` closes stdout under us, and the default
// behaviour is to crash with EPIPE — a stack trace for a command that worked.
process.stdout.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code !== "EPIPE") throw e;
});

async function call(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${URL_BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  let json: Record<string, unknown>;
  try { json = JSON.parse(text) as Record<string, unknown>; }
  catch { json = { error: text.slice(0, 200) }; }
  if (!res.ok) throw new Error(String(json.error ?? `${res.status} ${path}`));
  return json;
}

type State = { athletes: Athlete[]; bets: Bet[]; bounties: Bounty[]; me: Athlete | null;
  activities: Parameters<typeof betResult>[2]; settings: Parameters<typeof betResult>[3] };

async function signIn(): Promise<State> {
  return (await call("/api/session", { name: NAME })) as unknown as State;
}

/**
 * Ids are long and nobody types one, so the listings print a short code and
 * this takes it back.
 *
 * It is the TAIL of the id, not the head. An id is a timestamp in base 36
 * followed by some randomness (newId in lib/db), so two things made in the
 * same minute share their first six characters and a prefix would match both.
 */
const short = (id: string) => id.slice(-6);

function resolve<T extends { id: string }>(rows: T[], want: string, what: string): T {
  const hits = rows.filter((r) => r.id === want || r.id.endsWith(want));
  if (hits.length === 1) return hits[0];
  if (!hits.length) throw new Error(`No ${what} ending "${want}".`);
  throw new Error(`"${want}" matches ${hits.length} ${what}s — give me more of the id.`);
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const state = await signIn();
  const today = todayKey();
  const who = (id: string) => state.athletes.find((a) => a.id === id)?.name ?? "someone";

  if (!cmd || cmd === "bounties") {
    const rows = sortBounties(state.bounties, today);
    if (!rows.length) console.log("No bounties up.");
    for (const b of rows) {
      const tail = b.state === "paid" ? `paid to ${who(b.claimedBy ?? "")}`
        : b.state === "claimed" ? `CLAIMED by ${who(b.claimedBy ?? "")} — award or reject`
        : b.state === "void" ? "taken down"
        : b.expiresOn && today > b.expiresOn ? "expired"
        : b.expiresOn ? `open until ${b.expiresOn}` : "open";
      console.log(`${short(b.id)}  ${String(b.coins).padStart(5)}  ${b.title}`);
      console.log(`        ${tail}${b.detail ? ` · ${b.detail}` : ""}`);
    }
    if (cmd) return;
    console.log("");
  }

  if (!cmd || cmd === "bets") {
    const rows = state.bets.map((b) => ({ b, r: betResult(b, state.athletes, state.activities, state.settings, today) }));
    if (!rows.length) console.log("No bets on.");
    for (const { b, r } of rows) {
      const metric = BET_METRIC_BY_ID.get(b.metric)?.label ?? b.metric;
      const score = r.status === "offered" ? "offered"
        : r.status === "settled"
          ? r.push ? "push — stakes back" : `won by ${who(r.winnerId ?? "")}`
          : `${r.from} v ${r.to}`;
      console.log(`${short(b.id)}  ${String(b.stake).padStart(5)}  ${who(b.fromId)} v ${who(b.toId)}`);
      console.log(`        ${metric} · ${betWhen(b)} · ${r.status} · ${score}`);
    }
    return;
  }

  if (cmd === "bounty") {
    const [title, coinsRaw] = rest;
    if (!title || !coinsRaw) throw new Error(`Usage: bounty "The task" <coins> [--detail "..."] [--until YYYY-MM-DD]`);
    const out = await call("/api/arena", {
      action: "post", title, coins: Number(coinsRaw),
      detail: flag(rest, "detail") ?? "", expiresOn: flag(rest, "until") ?? null,
    });
    const b = out.bounty as Bounty;
    console.log(`Posted ${short(b.id)} — ${b.coins} on "${b.title}".`);
    return;
  }

  if (cmd === "claim") {
    const b = resolve(state.bounties, rest[0] ?? "", "bounty");
    await call("/api/arena", { action: "claim", id: b.id });
    console.log(`Claimed "${b.title}" — ${b.coins} once Ryan says it's done.`);
    return;
  }

  if (cmd === "award" || cmd === "reject" || cmd === "void") {
    const b = resolve(state.bounties, rest[0] ?? "", "bounty");
    await call("/api/arena", { action: cmd, id: b.id });
    console.log(cmd === "award" ? `Paid ${b.coins} to ${who(b.claimedBy ?? "")} for "${b.title}".`
      : cmd === "reject" ? `"${b.title}" is back on the board.`
      : `"${b.title}" taken down.`);
    return;
  }

  if (cmd === "bet") {
    const [name, metric, stakeRaw] = rest;
    if (!name || !metric || !stakeRaw) {
      throw new Error("Usage: bet <who> <points|km|sessions|swim|bike|run|gym> <stake> [--month] [--next] [--note \"...\"]");
    }
    // Exactly, never by prefix — Jona and Jonah are two different athletes.
    const them = state.athletes.find((a) => a.name.toLowerCase() === name.toLowerCase());
    if (!them) throw new Error(`No athlete called "${name}".`);
    if (!BET_METRIC_BY_ID.has(metric as BetMetric)) throw new Error(`Can't bet on "${metric}".`);
    const out = await call("/api/arena", {
      action: "propose", toId: them.id, metric, stake: Number(stakeRaw),
      period: rest.includes("--month") ? "month" : "week",
      when: rest.includes("--next") ? "next" : "this",
      note: flag(rest, "note") ?? "",
    });
    const b = out.bet as Bet;
    console.log(`Offered ${b.stake} to ${them.name} on ${b.metric}, ${betWhen(b)}. (${short(b.id)})`);
    return;
  }

  if (cmd === "accept" || cmd === "decline" || cmd === "cancel") {
    const b = resolve(state.bets, rest[0] ?? "", "bet");
    await call("/api/arena", { action: cmd, id: b.id });
    console.log(`${cmd}ed ${short(b.id)} — ${b.stake} with ${who(b.fromId === state.me?.id ? b.toId : b.fromId)}.`);
    return;
  }

  throw new Error(`Unknown command "${cmd}". Try: bounties, bounty, claim, award, reject, void, bets, bet, accept, decline, cancel.`);
}

main().catch((e: Error) => { console.error(e.message); process.exit(1); });
