"use client";

import { useMemo, useState } from "react";
import type { AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import type { League } from "./useLeague";
import { BOUNTY_MAX, BOUNTY_MIN, bountyFor, isOpen, sortBounties, type Bounty } from "@/lib/bounties";
import { ruleLabel } from "@/lib/bountyRules";
import { COIN } from "@/lib/club";
import { fmtCoins } from "@/lib/coins";
import { Avatar } from "./Avatar";
import { Glyph } from "./Glyph";

/**
 * Bounties: a task with coins on it, first man to do it takes them.
 *
 * The deliberate opposite of a bet. A bet is settled by the board because no
 * human is trusted to settle one; a bounty is settled by Ryan because the
 * whole point is that it can ask for things the board cannot see — swim at the
 * lake, drag Jonah out on a Sunday, ride in the rain. Tying bounties to
 * measurable targets would have made them a second, worse kind of bet.
 *
 * "First to do it" is enforced at the CLAIM, not at the payout: once somebody
 * has claimed it the board stops offering it, so two men don't both go and
 * ride fifty kilometres for the same hundred coins.
 */
export function ArenaBounties({
  state,
  refDay,
  send,
}: {
  state: AppState;
  refDay: DayKey;
  send: League["send"];
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // The league, for the bounties that settle themselves off the board.
  const league = useMemo(
    () => ({ athleteIds: state.athletes.map((a) => a.id), activities: state.activities, settings: state.settings }),
    [state.athletes, state.activities, state.settings],
  );
  const board = useMemo(() => sortBounties(state.bounties, refDay, league), [state.bounties, refDay, league]);

  async function act(id: string, action: string) {
    setBusy(id);
    setProblem(await send("/api/arena", { method: "POST", body: JSON.stringify({ action, id }) }));
    setBusy(null);
  }

  return (
    <div className="space-y-5">
      {state.isAdmin && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-2">You post them; whoever gets there first claims it.</p>
          <button
            onClick={() => { setPosting((v) => !v); setProblem(null); }}
            className="eyebrow rounded-lg bg-ink px-3 py-2 text-on-ink"
          >
            {posting ? "Never mind" : "Post one"}
          </button>
        </div>
      )}

      {posting && (
        <NewBounty send={send} onDone={(err) => { setProblem(err); if (!err) setPosting(false); }} />
      )}

      {problem && (
        <p role="alert" className="rounded-xl border border-magenta/40 bg-magenta/10 px-3 py-2 text-sm text-magenta">
          {problem}
        </p>
      )}

      {board.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-2">
          No bounties up.
          <br />
          <span className="text-ink-3">Tasks with coins attached. First to do it takes them.</span>
        </p>
      ) : (
        <div className="space-y-2">
          {board.map((b) => (
            <BountyCard
              key={b.id}
              bounty={b}
              state={state}
              refDay={refDay}
              busy={busy === b.id}
              onAct={act}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BountyCard({
  bounty, state, refDay, busy, onAct,
}: {
  bounty: Bounty;
  state: AppState;
  refDay: DayKey;
  busy: boolean;
  onAct: (id: string, action: string) => void;
}) {
  const league = {
    athleteIds: state.athletes.map((a) => a.id),
    activities: state.activities,
    settings: state.settings,
  };
  // A self-awarding bounty has no claimant — it has a winner, worked out from
  // the board. Everything below reads the same either way.
  const won = bounty.rule ? bountyFor(bounty, league, refDay) : null;
  const live = isOpen(bounty, refDay, league);
  const claimer = state.athletes.find((a) => a.id === (won?.athleteId ?? bounty.claimedBy));
  const mine = (won?.athleteId ?? bounty.claimedBy) === state.me?.id;
  const expired = bounty.state === "open" && !live;

  const tone = live ? "border-gold/40"
    : bounty.state === "claimed" ? "border-cyan/40"
    : won || bounty.state === "paid" ? "border-mint/40"
    : "border-line";

  return (
    <article className={`rounded-2xl border ${tone} bg-tile px-4 py-3`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{bounty.title}</p>
          {bounty.detail && <p className="mt-0.5 text-xs text-ink-2">{bounty.detail}</p>}
          {bounty.rule && (
            // Say the rule in the board's own words, so nobody has to guess
            // what the app is actually watching for.
            <p className="mt-1 font-mono text-[0.65rem] text-cyan">
              {ruleLabel(bounty.rule)} · the board awards it
            </p>
          )}
          <p className="mt-1 font-mono text-[0.7rem] text-ink-3">
            {won ? `Won by ${claimer?.name ?? "someone"} on ${won.day}`
              : bounty.state === "paid" ? `Paid to ${claimer?.name ?? "someone"}`
              : bounty.state === "claimed" ? `Claimed by ${claimer?.name ?? "someone"}`
              : bounty.state === "void" ? "Taken down"
              : expired ? "Expired"
              : bounty.expiresOn ? `Open until ${bounty.expiresOn}` : "Open"}
          </p>
        </div>
        <div className="text-right">
          <p className={`stamp text-lg ${bounty.state === "paid" ? "text-mint" : live ? "text-gold" : "text-ink-2"}`}>
            {fmtCoins(bounty.coins)}
          </p>
          <p className="eyebrow text-[0.6rem] text-ink-3">{COIN.short}</p>
        </div>
        {claimer && <Avatar athlete={claimer} className="h-8 w-8 text-xs" />}
      </div>

      {/* A bounty the board awards has nothing to claim — the server refuses
          one — so it gets no "I did it". Showing it anyway was a button that
          only ever answered with an error. Ryan can still take one down. */}
      {live && !state.isAdmin && !bounty.rule && (
        <button disabled={busy} onClick={() => onAct(bounty.id, "claim")}
          className="eyebrow mt-3 w-full rounded-lg bg-gold/20 py-2 text-gold disabled:opacity-40">
          I did it
        </button>
      )}
      {live && state.isAdmin && (
        <div className="mt-3 flex gap-2">
          {!bounty.rule && (
            <button disabled={busy} onClick={() => onAct(bounty.id, "claim")}
              className="eyebrow flex-1 rounded-lg bg-gold/20 py-2 text-gold">I did it</button>
          )}
          <button disabled={busy} onClick={() => onAct(bounty.id, "void")}
            className="eyebrow flex-1 rounded-lg border border-line py-2 text-ink-2">Take down</button>
        </div>
      )}

      {/* Only Ryan settles one, and he can send it back to the board as well
          as pay it — a claim that turns out to be wishful thinking should not
          cost everybody else the bounty. */}
      {bounty.state === "claimed" && state.isAdmin && (
        <div className="mt-3 flex gap-2">
          <button disabled={busy} onClick={() => onAct(bounty.id, "award")}
            className="eyebrow flex-1 rounded-lg bg-mint/20 py-2 text-mint">
            Pay {fmtCoins(bounty.coins)}
          </button>
          <button disabled={busy} onClick={() => onAct(bounty.id, "reject")}
            className="eyebrow flex-1 rounded-lg border border-line py-2 text-ink-2">Send back</button>
        </div>
      )}
      {bounty.state === "claimed" && !state.isAdmin && mine && (
        <p className="mt-2 text-xs text-ink-3">Waiting on Ryan.</p>
      )}
    </article>
  );
}

function NewBounty({
  send, onDone,
}: {
  send: League["send"];
  onDone: (err: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [coins, setCoins] = useState(200);
  const [expiresOn, setExpiresOn] = useState("");
  const [busy, setBusy] = useState(false);

  async function post() {
    setBusy(true);
    onDone(await send("/api/arena", {
      method: "POST",
      body: JSON.stringify({ action: "post", title, detail, coins, expiresOn: expiresOn || null }),
    }));
    setBusy(false);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-tile p-4">
      <Field label="The task">
        <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)}
          placeholder="Swim at the lake before it freezes" className={INPUT} />
      </Field>
      <Field label="Any rules (optional)">
        <input value={detail} maxLength={400} onChange={(e) => setDetail(e.target.value)}
          placeholder="Photo or it didn't happen" className={INPUT} />
      </Field>
      <Field label={`Coins (${BOUNTY_MIN}–${BOUNTY_MAX})`}>
        <input type="number" inputMode="numeric" value={coins} min={BOUNTY_MIN} max={BOUNTY_MAX}
          onChange={(e) => setCoins(Number(e.target.value))} className={INPUT} />
      </Field>
      <Field label="Open until (optional)">
        <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={INPUT} />
      </Field>
      <button onClick={post} disabled={busy || !title.trim()}
        className="eyebrow w-full rounded-lg bg-ink py-3 text-on-ink disabled:opacity-40">
        <Glyph name="target" className="mr-1.5 inline h-4 w-4 -translate-y-px align-text-bottom" />
        Put {fmtCoins(coins)} {COIN.many} on it
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
