"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { coinAccount, coinBoard, fmtCoins, type CoinEntry } from "@/lib/coins";
import type { AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import { Avatar } from "./Avatar";
import { Glyph, type GlyphName } from "./Glyph";
import type { League } from "./useLeague";
import { TRANSFER_MAX, TRANSFER_MIN } from "@/lib/transfers";

const KIND_GLYPH: Record<CoinEntry["kind"], GlyphName> = {
  points: "bolt",
  quota: "shield",
  week: "trophy",
  month: "medal",
  season: "crown",
  grant: "diamond",
  spend: "trash",
  bet: "trio",
  bounty: "target",
  gift: "heart",
};

/**
 * The wallet: your balance, everyone else's, and the line-by-line story of
 * where the coins came from.
 *
 * The ledger is the point. A number on its own invites "that can't be right";
 * a number with every session and bonus behind it answers the question before
 * it gets asked. Coins are derived from the board (see lib/coins.ts), so this
 * is a view of history rather than a second set of books.
 */
export function Wallet({
  state,
  refDay,
  send,
}: {
  state: AppState;
  refDay: DayKey;
  /** Omitted where the wallet is read-only; sending coins needs it. */
  send?: League["send"];
}) {
  const [showAll, setShowAll] = useState(false);
  const [sending, setSending] = useState(false);
  const meId = state.me?.id ?? "";

  const account = useMemo(
    () => coinAccount(meId, state.athletes, state.activities, state.settings, refDay,
      state.coinGrants, state.purchases, state.bets, state.bounties, state.transfers),
    [meId, state.athletes, state.activities, state.settings, refDay, state.coinGrants,
     state.purchases, state.bets, state.bounties, state.transfers],
  );
  const board = useMemo(
    () => coinBoard(state.athletes, state.activities, state.settings, refDay,
      state.coinGrants, state.purchases, state.bets, state.bounties, state.transfers),
    [state.athletes, state.activities, state.settings, refDay, state.coinGrants,
     state.purchases, state.bets, state.bounties, state.transfers],
  );

  const bonuses = account.entries.filter((e) => e.kind !== "points");
  const shown = showAll ? account.entries : account.entries.slice(0, 12);
  const myRank = board.findIndex((r) => r.athlete.id === meId) + 1;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl pane border border-gold/40 px-5 py-6 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--color-gold) 18%, transparent) 0%, transparent 70%)",
          }}
        />
        <div className="relative flex items-center justify-center gap-4">
          <Image
            src="/tri-coin.png"
            alt=""
            width={256}
            height={256}
            className="h-14 w-14 shrink-0 object-contain"
            priority
          />
          <div className="text-left">
            <div className="stamp text-4xl leading-none text-gold tabular-nums">
              {fmtCoins(account.balance)}
            </div>
            <div className="eyebrow mt-1 text-ink-3">
              tri coins{myRank > 0 ? ` · ${ordinal(myRank)} richest` : ""}
            </div>
          </div>
        </div>
      </section>

      {send && state.athletes.length > 1 && (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h3 className="eyebrow text-ink-3">Hand some over</h3>
            <button
              onClick={() => setSending((v) => !v)}
              className="eyebrow rounded-lg border border-line px-3 py-1.5 text-ink-2"
            >
              {sending ? "Never mind" : "Send coins"}
            </button>
          </div>
          {sending && (
            <SendCoins
              state={state}
              balance={account.balance}
              send={send}
              onDone={(err) => { if (!err) setSending(false); }}
            />
          )}
        </section>
      )}

      <section>
        <h3 className="eyebrow text-ink-3">Where it came from</h3>
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl pane border border-line bg-tile">
          {shown.map((e, i) => (
            <li key={`${e.day}-${e.kind}-${i}`} className="flex items-center gap-3 px-3.5 py-2.5">
              <Glyph
                name={KIND_GLYPH[e.kind]}
                className={`h-4 w-4 shrink-0 ${e.kind === "points" ? "text-ink-3" : "text-gold"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] text-ink">{e.label}</span>
                <span className="font-mono text-[0.625rem] text-ink-3">{e.detail}</span>
              </span>
              <span
                className={`stamp shrink-0 text-base tabular-nums ${
                  e.amount < 0 ? "text-ink-3" : "text-gold"
                }`}
              >
                {e.amount < 0 ? "−" : "+"}
                {fmtCoins(Math.abs(e.amount))}
              </span>
            </li>
          ))}
          {shown.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-ink-2">
              Nothing yet. Log a session and the coins follow.
            </li>
          )}
        </ul>
        {account.entries.length > 12 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="eyebrow mt-2 w-full rounded-xl border border-dashed border-line py-2.5 text-ink-2"
          >
            {showAll ? "Show less" : `Show all ${account.entries.length}`}
          </button>
        )}
        <p className="mt-2 text-center font-mono text-xs text-ink-3">
          {bonuses.length} bonus{bonuses.length === 1 ? "" : "es"}
          {" · "}
          backdated to the league&rsquo;s first day
        </p>
      </section>

      <section>
        <h3 className="eyebrow text-ink-3">Everyone</h3>
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl pane border border-line bg-tile">
          {board.map((row, i) => (
            <li
              key={row.athlete.id}
              className={`flex items-center gap-3 px-3.5 py-2.5 ${
                row.athlete.id === meId ? "bg-deck-2/40" : ""
              }`}
            >
              <span className="w-4 shrink-0 font-mono text-xs text-ink-3">{i + 1}</span>
              <Avatar athlete={row.athlete} className="h-7 w-7 shrink-0 text-[0.625rem]" />
              <span className="min-w-0 flex-1 truncate text-[0.875rem] text-ink">
                {row.athlete.name}
              </span>
              <span className="shrink-0 font-mono text-[0.8125rem] tabular-nums text-ink-2">
                {fmtCoins(row.balance)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

/**
 * Handing coins to somebody.
 *
 * Deliberately plain and deliberately final: there is no "cancel a transfer".
 * A gift you can take back is not a gift, and between six mates the fix for a
 * mistake is the other man sending it back — which is the same two taps.
 */
function SendCoins({
  state,
  balance,
  send,
  onDone,
}: {
  state: AppState;
  balance: number;
  send: League["send"];
  onDone: (err: string | null) => void;
}) {
  const others = state.athletes.filter((a) => a.id !== state.me?.id);
  const [toId, setToId] = useState(others[0]?.id ?? "");
  const [amount, setAmount] = useState(100);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    const err = await send("/api/arena", {
      method: "POST",
      body: JSON.stringify({ action: "send", toId, amount, note }),
    });
    setProblem(err);
    setBusy(false);
    onDone(err);
  }

  const them = others.find((a) => a.id === toId);

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-line bg-tile p-4">
      <label className="block">
        <span className="eyebrow block pb-1 text-ink-3">To</span>
        <select value={toId} onChange={(e) => setToId(e.target.value)} className={INPUT}>
          {others.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="eyebrow block pb-1 text-ink-3">How many</span>
        <input type="number" inputMode="numeric" value={amount}
          min={TRANSFER_MIN} max={TRANSFER_MAX}
          onChange={(e) => setAmount(Number(e.target.value))} className={INPUT} />
      </label>
      <label className="block">
        <span className="eyebrow block pb-1 text-ink-3">What for (optional)</span>
        <input value={note} maxLength={140} onChange={(e) => setNote(e.target.value)}
          placeholder="you earned it" className={INPUT} />
      </label>
      {problem && (
        <p role="alert" className="text-sm text-magenta">{problem}</p>
      )}
      <button
        onClick={go}
        disabled={busy || !toId || amount < TRANSFER_MIN || amount > balance}
        className="eyebrow w-full rounded-lg bg-gold py-3 text-on-gold disabled:opacity-40"
      >
        {amount > balance
          ? `You only have ${fmtCoins(balance)}`
          : `Send ${fmtCoins(amount)} to ${them?.name ?? "them"}`}
      </button>
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-line bg-deck px-3 py-2 text-sm text-ink outline-none focus:border-ink-2";
