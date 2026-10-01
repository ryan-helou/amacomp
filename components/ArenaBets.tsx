"use client";

import { useMemo, useState } from "react";
import type { AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import type { League } from "./useLeague";
import {
  BET_METRICS, BET_METRIC_BY_ID, STAKE_MAX, STAKE_MIN,
  betResult, betWhen, type Bet, type BetMetric, type BetResult,
} from "@/lib/bets";
import { coinAccount, fmtCoins } from "@/lib/coins";
import { COIN } from "@/lib/club";
import { Avatar } from "./Avatar";
import { Glyph } from "./Glyph";

/**
 * Bets: stake coins head to head, and let the board settle it.
 *
 * The screen is built around the one thing a man opening it wants to know:
 * what is waiting on HIM. Offers he has to answer come first, then what is
 * running, then the history — and the form to start a new one is behind a
 * button rather than sitting at the top, because most visits are to check a
 * score rather than to pick a fight.
 *
 * Nothing on this screen decides anything. Every number in it is computed
 * from the same activities the Board is drawn from (lib/bets.ts), so a bet
 * card and the table can never disagree.
 */
export function ArenaBets({
  state,
  refDay,
  send,
}: {
  state: AppState;
  refDay: DayKey;
  send: League["send"];
}) {
  const meId = state.me?.id ?? "";
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const balance = useMemo(
    () => coinAccount(meId, state.athletes, state.activities, state.settings, refDay,
      state.coinGrants, state.purchases, state.bets, state.bounties).balance,
    [meId, state.athletes, state.activities, state.settings, refDay,
     state.coinGrants, state.purchases, state.bets, state.bounties],
  );

  const mine = useMemo(() => {
    const rows = state.bets
      .filter((b) => b.fromId === meId || b.toId === meId)
      .map((bet) => ({
        bet,
        result: betResult(bet, state.athletes, state.activities, state.settings, refDay),
      }));
    return {
      /** Offers waiting on me — the only thing here that needs an answer. */
      inbox: rows.filter((r) => r.result.status === "offered" && r.bet.toId === meId),
      sent: rows.filter((r) => r.result.status === "offered" && r.bet.fromId === meId),
      live: rows.filter((r) => r.result.status === "live"),
      done: rows.filter(
        (r) => r.result.status === "settled" || r.result.status === "declined"
          || r.result.status === "cancelled",
      ),
    };
  }, [state.bets, state.athletes, state.activities, state.settings, refDay, meId]);

  async function act(id: string, action: string) {
    setBusy(id);
    setProblem(await send("/api/arena", { method: "POST", body: JSON.stringify({ action, id }) }));
    setBusy(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          <span className="font-mono text-ink">{fmtCoins(balance)}</span> {COIN.many} to stake.
        </p>
        <button
          onClick={() => { setOpen((v) => !v); setProblem(null); }}
          className="eyebrow rounded-lg bg-ink px-3 py-2 text-on-ink"
        >
          {open ? "Never mind" : "New bet"}
        </button>
      </div>

      {open && (
        <NewBet
          state={state}
          balance={balance}
          onDone={(err) => { setProblem(err); if (!err) setOpen(false); }}
          send={send}
        />
      )}

      {problem && (
        <p role="alert" className="rounded-xl border border-magenta/40 bg-magenta/10 px-3 py-2 text-sm text-magenta">
          {problem}
        </p>
      )}

      <Group title="Waiting on you" rows={mine.inbox} meId={meId} state={state}
        actions={(id) => (
          <div className="flex gap-2">
            <button disabled={busy === id} onClick={() => act(id, "accept")}
              className="eyebrow flex-1 rounded-lg bg-mint/20 py-2 text-mint">Take it</button>
            <button disabled={busy === id} onClick={() => act(id, "decline")}
              className="eyebrow flex-1 rounded-lg border border-line py-2 text-ink-2">Decline</button>
          </div>
        )} />

      <Group title="Offered" rows={mine.sent} meId={meId} state={state}
        actions={(id) => (
          <button disabled={busy === id} onClick={() => act(id, "cancel")}
            className="eyebrow w-full rounded-lg border border-line py-2 text-ink-2">Pull it</button>
        )} />

      <Group title="Running" rows={mine.live} meId={meId} state={state} />
      <Group title="Settled" rows={mine.done} meId={meId} state={state} />

      {state.bets.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-2">
          Nothing on yet.
          <br />
          <span className="text-ink-3">Stake coins head to head and the app settles it off the board.</span>
        </p>
      )}
    </div>
  );
}

function Group({
  title, rows, meId, state, actions,
}: {
  title: string;
  rows: { bet: Bet; result: BetResult }[];
  meId: string;
  state: AppState;
  actions?: (id: string) => React.ReactNode;
}) {
  if (!rows.length) return null;
  return (
    <section>
      <h3 className="eyebrow text-ink-2">{title}</h3>
      <div className="mt-2 space-y-2">
        {rows.map(({ bet, result }) => (
          <BetCard key={bet.id} bet={bet} result={result} meId={meId} state={state}
            actions={actions?.(bet.id)} />
        ))}
      </div>
    </section>
  );
}

function BetCard({
  bet, result, meId, state, actions,
}: {
  bet: Bet;
  result: BetResult;
  meId: string;
  state: AppState;
  actions?: React.ReactNode;
}) {
  const other = state.athletes.find((a) => a.id === (bet.fromId === meId ? bet.toId : bet.fromId));
  const metric = BET_METRIC_BY_ID.get(bet.metric);
  const myValue = bet.fromId === meId ? result.from : result.to;
  const theirValue = bet.fromId === meId ? result.to : result.from;
  const won = result.winnerId === meId;
  const settled = result.status === "settled";
  // Ahead/behind rather than a bare pair of numbers: the question a man asks
  // of a running bet is "am I winning", and two numbers make him do the sum.
  const edge = myValue - theirValue;

  const tone = settled
    ? result.push ? "border-line" : won ? "border-mint/50" : "border-magenta/40"
    : result.status === "live" ? "border-gold/40" : "border-line";

  return (
    <article className={`rounded-2xl border ${tone} bg-tile px-4 py-3`}>
      <div className="flex items-center gap-3">
        {other && <Avatar athlete={other} className="h-8 w-8 text-xs" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {bet.fromId === meId ? "You" : other?.name} v {bet.fromId === meId ? other?.name : "you"}
          </p>
          <p className="truncate font-mono text-xs text-ink-2">
            {metric?.label} · {betWhen(bet)}
          </p>
        </div>
        <div className="text-right">
          <p className={`stamp text-lg ${settled ? (result.push ? "text-ink-2" : won ? "text-mint" : "text-magenta") : "text-ink"}`}>
            {fmtCoins(bet.stake)}
          </p>
          <p className="eyebrow text-[0.6rem] text-ink-3">{COIN.short}</p>
        </div>
      </div>

      {result.status !== "offered" && result.status !== "declined" && result.status !== "cancelled" && (
        <div className="mt-2 flex items-baseline justify-between font-mono text-xs">
          <span className="text-ink-2">
            {fmtNum(myValue)} <span className="text-ink-3">v</span> {fmtNum(theirValue)} {metric?.unit}
          </span>
          <span className={edge > 0 ? "text-mint" : edge < 0 ? "text-magenta" : "text-ink-3"}>
            {settled
              ? result.push ? "Push — stakes back" : won ? "Won" : "Lost"
              : edge === 0 ? "Level" : edge > 0 ? `+${fmtNum(edge)} up` : `${fmtNum(-edge)} behind`}
          </span>
        </div>
      )}

      {result.status === "declined" && <p className="mt-2 text-xs text-ink-3">Declined.</p>}
      {result.status === "cancelled" && <p className="mt-2 text-xs text-ink-3">Pulled.</p>}
      {bet.note && <p className="mt-2 text-xs text-ink-2">&ldquo;{bet.note}&rdquo;</p>}
      {actions && <div className="mt-3">{actions}</div>}
    </article>
  );
}

/** Kilometres want a decimal; points and sessions do not. */
function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

function NewBet({
  state, balance, onDone, send,
}: {
  state: AppState;
  balance: number;
  onDone: (err: string | null) => void;
  send: League["send"];
}) {
  const others = state.athletes.filter((a) => a.id !== state.me?.id);
  const [toId, setToId] = useState(others[0]?.id ?? "");
  const [metric, setMetric] = useState<BetMetric>("points");
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [when, setWhen] = useState<"this" | "next">("this");
  const [stake, setStake] = useState(100);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function propose() {
    setBusy(true);
    onDone(await send("/api/arena", {
      method: "POST",
      body: JSON.stringify({ action: "propose", toId, metric, period, when, stake, note }),
    }));
    setBusy(false);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-tile p-4">
      <Field label="Against">
        <select value={toId} onChange={(e) => setToId(e.target.value)} className={INPUT}>
          {others.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>

      <Field label="On">
        <select value={metric} onChange={(e) => setMetric(e.target.value as BetMetric)} className={INPUT}>
          {BET_METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Field>

      <Field label="Over">
        <div className="flex gap-2">
          {(["week", "month"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`eyebrow flex-1 rounded-lg py-2 ${period === p ? "bg-ink text-on-ink" : "border border-line text-ink-2"}`}>
              {p}
            </button>
          ))}
          {/* "Next" matters: a bet proposed on a Sunday night about the week
              that is ending is not a bet, it is a result. */}
          {(["this", "next"] as const).map((w) => (
            <button key={w} onClick={() => setWhen(w)}
              className={`eyebrow flex-1 rounded-lg py-2 ${when === w ? "bg-ink text-on-ink" : "border border-line text-ink-2"}`}>
              {w}
            </button>
          ))}
        </div>
      </Field>

      <Field label={`Stake (${STAKE_MIN}–${STAKE_MAX})`}>
        <input type="number" inputMode="numeric" value={stake} min={STAKE_MIN} max={STAKE_MAX}
          onChange={(e) => setStake(Number(e.target.value))} className={INPUT} />
      </Field>

      <Field label="Say something (optional)">
        <input value={note} maxLength={140} onChange={(e) => setNote(e.target.value)}
          placeholder="easy money" className={INPUT} />
      </Field>

      <button
        onClick={propose}
        disabled={busy || !toId || stake > balance}
        className="eyebrow w-full rounded-lg bg-ink py-3 text-on-ink disabled:opacity-40"
      >
        <Glyph name="trio" className="mr-1.5 inline h-4 w-4 -translate-y-px align-text-bottom" />
        {stake > balance ? `You only have ${fmtCoins(balance)}` : `Offer ${fmtCoins(stake)} ${COIN.many}`}
      </button>
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-line bg-deck px-3 py-2 text-sm text-ink outline-none focus:border-ink-2";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow block pb-1 text-ink-3">{label}</span>
      {children}
    </label>
  );
}
