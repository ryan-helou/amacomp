"use client";

import { useMemo } from "react";
import { fmtPoints } from "@/lib/scoring";
import { seasonRace, type RaceRow } from "@/lib/race";
import type { AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import { Avatar } from "./Avatar";

/**
 * The run-in — the season as a race rather than a list.
 *
 * The board underneath this already ranks the season perfectly well. What it
 * can't do is say that three points and three weeks are all that separate the
 * top two, which is the only thing anyone in that position wants to know. So
 * this leads with the margin, then gives every athlete the two numbers a list
 * leaves out: where their current form lands them, and what it would take to
 * finish level with the leader.
 *
 * Sits above the lanes and only on the Season tab, because it is answering a
 * question about the season specifically.
 */
export function SeasonRace({
  state,
  refDay,
  meId,
}: {
  state: AppState;
  refDay: DayKey;
  meId?: string;
}) {
  const race = useMemo(
    () => seasonRace(state.athletes, state.activities, state.settings, refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );

  // Pre-season, or a season nobody has scored in yet: there is no race to call,
  // and an empty card claiming one is worse than no card.
  if (!race || race.rows.length < 2 || race.rows[0].points <= 0) return null;

  const [first, second] = race.rows;
  const me = meId ? race.rows.find((r) => r.athlete.id === meId) : undefined;
  const done = race.daysLeft === 0;

  // Only the people actually in it. The lanes directly below already list the
  // whole season in full, so repeating six names here is duplication — and
  // someone 253 points back is not in a race, they are on a table.
  //
  // The podium, plus anyone form says is heading for it, plus you wherever you
  // are: no magic threshold, and it widens on its own when the race is tight
  // further down.
  const contenders = race.rows.filter(
    (r) => r.rank <= 3 || r.projectedRank <= 3 || r.athlete.id === meId,
  );
  const rest = race.rows.length - contenders.length;

  return (
    <section className="rounded-2xl border border-line pane bg-tile p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="eyebrow text-ink-2">
          {done ? "Final day" : race.leadChanges ? "The run-in · live" : "The run-in"}
        </h2>
        <span className="font-mono text-xs text-ink-3">
          {done ? "last day to score" : `${race.daysLeft} day${race.daysLeft === 1 ? "" : "s"} left`}
        </span>
      </div>

      {/* The headline: the gap at the top, in the biggest type on the card.
          A three-point margin is the story; burying it in a table isn't. */}
      <div className="mt-3 flex items-end gap-3">
        <div className="shrink-0">
          <div className="stamp text-4xl leading-none text-ink">{fmtPoints(race.margin)}</div>
          <div className="eyebrow mt-1 text-ink-3">pts apart</div>
        </div>
        <p className="flex-1 pb-1 text-sm leading-snug text-ink-2">
          <span className="font-semibold text-ink">{first.athlete.name}</span> leads{" "}
          <span className="font-semibold text-ink">{second.athlete.name}</span>
          {race.leadChanges ? (
            <>
              {" "}
              — but on the last {race.formDays} days&rsquo; form,{" "}
              <span className="font-semibold text-ink">{projectedWinner(race.rows).athlete.name}</span>{" "}
              takes it.
            </>
          ) : (
            <> in {race.season.label}.</>
          )}
        </p>
      </div>

      <ol className="mt-4 space-y-0">
        {contenders.map((row, i) => (
          <li key={row.athlete.id}>
            {i > 0 && <div className="lane-rope my-1" />}
            <Row row={row} isMe={row.athlete.id === meId} showProjection={!done} />
          </li>
        ))}
      </ol>
      {rest > 0 && (
        <p className="mt-2 text-center font-mono text-[0.6875rem] text-ink-3">
          {rest} more on the board below
        </p>
      )}

      {/* One plain sentence for the person reading, because "32.0/day" in a
          table cell is a number and "you need 32 a day" is an instruction. */}
      {me && me.needPerDay !== null && (
        <p className="mt-3 border-t border-line pt-3 text-sm text-ink-2">
          You need{" "}
          <span className="font-semibold text-ink">{fmtPoints(me.needPerDay)} pts a day</span> for
          the last {race.daysLeft} to finish level with {first.athlete.name}.
        </p>
      )}
      {me && me.rank === 1 && !done && (
        <p className="mt-3 border-t border-line pt-3 text-sm text-ink-2">
          You&rsquo;re leading with {race.daysLeft} days to hold on.
        </p>
      )}

      <p className="mt-2 text-[0.6875rem] leading-snug text-ink-3">
        Projection carries the last {race.formDays} days&rsquo; scoring rate to{" "}
        {race.season.monthsLabel.split("–")[1]} {race.season.end.slice(8)}. It&rsquo;s a pace, not a
        prediction.
      </p>
    </section>
  );
}

function projectedWinner(rows: RaceRow[]): RaceRow {
  return rows.reduce((best, r) => (r.projected > best.projected ? r : best), rows[0]);
}

function Row({
  row,
  isMe,
  showProjection,
}: {
  row: RaceRow;
  isMe: boolean;
  showProjection: boolean;
}) {
  // A mover is someone whose form puts them somewhere other than where they
  // stand — the single most interesting thing this card knows about them.
  const move = row.rank - row.projectedRank;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-2 py-2 ${
        isMe ? "bg-deck-2 ring-1 ring-ink/20" : ""
      }`}
    >
      <span
        className={`stamp w-5 shrink-0 text-center text-lg ${
          row.rank === 1 ? "text-gold" : "text-ink-3"
        }`}
      >
        {row.rank}
      </span>
      <Avatar athlete={row.athlete} me={isMe} className="h-7 w-7 text-[0.5625rem]" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-semibold text-ink">{row.athlete.name}</span>
          {isMe && <span className="text-xs font-normal text-ink-2">you</span>}
        </div>
        <div className="font-mono text-[0.6875rem] text-ink-3">
          {row.rank === 1 ? "leads" : `−${fmtPoints(row.behind)}`}
          {showProjection && (
            <>
              {" · "}
              <span className="text-ink-2">
                on {fmtPoints(row.rate)}/day
              </span>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="stamp text-lg text-ink">{fmtPoints(row.points)}</div>
        {showProjection && (
          <div className="flex items-center justify-end gap-1 font-mono text-[0.6875rem] text-ink-3">
            {move !== 0 && (
              <span
                className={move > 0 ? "font-bold text-good" : "font-bold text-run"}
                title={
                  move > 0
                    ? `Projected to climb ${move} place${move === 1 ? "" : "s"}`
                    : `Projected to drop ${-move} place${move === -1 ? "" : "s"}`
                }
              >
                {move > 0 ? `▲${move}` : `▼${-move}`}
              </span>
            )}
            <span aria-hidden className="opacity-50">&rarr;</span>
            {/* Whole points. A projection is a pace carried forward, and a
                decimal on it claims a precision it does not have. */}
            <span title="Projected finish">{Math.round(row.projected)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
