"use client";

import { useMemo, type ReactNode } from "react";
import { fmtPoints } from "@/lib/scoring";
import { seasonRace, type RaceRow, type SeasonRace as Race } from "@/lib/race";
import type { AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import { Avatar } from "./Avatar";

/**
 * The run-in — the season as a race rather than a list.
 *
 * The board underneath already ranks the season perfectly well. What it cannot
 * do is say that three points and three weeks separate the top two, which is
 * the only thing anyone in that position wants to know.
 *
 * THE CARD MUST NOT SHOW ONLY THE FLATTERING NUMBER. The first version led with
 * a giant "3 PTS APART" and then quietly projected the leader 378 clear — the
 * same card telling two opposite stories with nothing joining them. Three
 * points is the gap TODAY; the fortnight of form behind it is what decides
 * whether that gap closes or evaporates, so the headline states both and names
 * the reason. Every column is labelled too: an unlabelled "863 -> 1538" is a
 * puzzle, not information.
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

  const me = meId ? race.rows.find((r) => r.athlete.id === meId) : undefined;
  const done = race.daysLeft === 0;

  // Only the people actually in it. The lanes directly below already list the
  // whole season in full, so repeating six names here is duplication — and
  // someone 253 points back is not in a race, they are on a table.
  const contenders = race.rows.filter(
    (r) => r.rank <= 3 || r.projectedRank <= 3 || r.athlete.id === meId,
  );
  const rest = race.rows.length - contenders.length;

  return (
    <section className="rounded-2xl border border-line pane bg-tile p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="eyebrow text-ink-2">{done ? "Final day" : "The run-in"}</h2>
        <span className="font-mono text-xs text-ink-3">
          {done ? "last day to score" : `${race.daysLeft} day${race.daysLeft === 1 ? "" : "s"} left`}
        </span>
      </div>

      <Headline race={race} done={done} />

      {/* Labelled, or three bare numbers on a row are a riddle. */}
      <div className="mt-4 flex items-end gap-2 border-b border-line pb-1 pl-[3.75rem] font-mono text-[0.625rem] uppercase tracking-wide text-ink-3">
        <span className="flex-1">now</span>
        {!done && (
          <>
            <span className="w-[3.75rem] text-right">per day</span>
            <span className="w-[3.75rem] text-right">by {shortEnd(race)}</span>
          </>
        )}
      </div>

      <ol className="space-y-0">
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

      {/* The instruction, and — crucially — what you are actually on. "You need
          30.9 a day" means nothing until you know you have been doing 13.6. */}
      {me && me.needPerDay !== null && (
        <p className="mt-3 border-t border-line pt-3 text-sm text-ink-2">
          You need <span className="font-semibold text-ink">{fmtPoints(me.needPerDay)} a day</span>{" "}
          for the last {race.daysLeft} days to catch {race.rows[0].athlete.name}. You&rsquo;re on{" "}
          <span className={`font-semibold ${me.rate >= me.needPerDay ? "text-good" : "text-run"}`}>
            {fmtPoints(me.rate)}
          </span>
          .
        </p>
      )}
      {me && me.rank === 1 && !done && (
        <p className="mt-3 border-t border-line pt-3 text-sm text-ink-2">
          You&rsquo;re leading with {race.daysLeft} days to hold on.
        </p>
      )}

      <p className="mt-2 text-[0.6875rem] leading-snug text-ink-3">
        &ldquo;Per day&rdquo; is what each of you has averaged over the last {race.formDays} days.
        The last column carries that rate to the end of the season — a pace, not a prediction.
      </p>
    </section>
  );
}

/** "30 Sep" — the day the projection runs to, for the column header. */
function shortEnd(race: Race): string {
  const [, m, d] = race.season.end.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]}`;
}

/**
 * The headline: the gap at the top, and then the thing that decides whether it
 * survives. Four shapes, because four genuinely different things can be true.
 */
function Headline({ race, done }: { race: Race; done: boolean }) {
  const [first, second] = race.rows;
  const projWinner = race.rows.reduce((b, r) => (r.projected > b.projected ? r : b), race.rows[0]);

  let story: ReactNode;
  if (done) {
    story = (
      <>
        <strong className="font-semibold text-ink">{first.athlete.name}</strong> takes{" "}
        {race.season.label}.
      </>
    );
  } else if (race.leadChanges) {
    story = (
      <>
        <strong className="font-semibold text-ink">{first.athlete.name}</strong> leads today, but{" "}
        <strong className="font-semibold text-ink">{projWinner.athlete.name}</strong> has been
        scoring {fmtPoints(projWinner.rate)} a day to {fmtPoints(first.rate)}. At those rates he
        takes it by {Math.round(race.projectedMargin)}.
      </>
    );
  } else if (race.projectedMargin > race.margin * 3 && race.projectedMargin > 20) {
    // The gap is about to open up. Leading with "3 pts apart" and nothing else
    // would be the most misleading thing on the screen.
    story = (
      <>
        <strong className="font-semibold text-ink">{first.athlete.name}</strong> leads{" "}
        <strong className="font-semibold text-ink">{second.athlete.name}</strong> — and he&rsquo;s
        pulling away, on {fmtPoints(first.rate)} a day to {fmtPoints(second.rate)}. At those rates
        he finishes{" "}
        <strong className="font-semibold text-ink">{Math.round(race.projectedMargin)}</strong> clear.
      </>
    );
  } else {
    story = (
      <>
        <strong className="font-semibold text-ink">{first.athlete.name}</strong> leads{" "}
        <strong className="font-semibold text-ink">{second.athlete.name}</strong>, and on current
        form it stays close — {Math.round(race.projectedMargin)} apart at the end.
      </>
    );
  }

  return (
    <div className="mt-3 flex items-start gap-3">
      <div className="shrink-0">
        <div className="stamp text-4xl leading-none text-ink">{fmtPoints(race.margin)}</div>
        <div className="eyebrow mt-1 text-ink-3">apart today</div>
      </div>
      <p className="flex-1 text-sm leading-snug text-ink-2">{story}</p>
    </div>
  );
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
      className={`flex items-center gap-2 rounded-xl px-2 py-2 ${
        isMe ? "bg-deck-2 ring-1 ring-ink/20" : ""
      }`}
    >
      <span
        className={`stamp w-4 shrink-0 text-center text-lg ${
          row.rank === 1 ? "text-gold" : "text-ink-3"
        }`}
      >
        {row.rank}
      </span>
      <Avatar athlete={row.athlete} me={isMe} className="h-7 w-7 shrink-0 text-[0.5625rem]" />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">
          {row.athlete.name}
          {isMe && <span className="ml-1 text-xs font-normal text-ink-2">you</span>}
        </div>
        <div className="stamp text-lg leading-none text-ink">{fmtPoints(row.points)}</div>
      </div>

      {showProjection && (
        <>
          <span className="w-[3.75rem] shrink-0 text-right font-mono text-xs text-ink-2">
            {fmtPoints(row.rate)}
          </span>
          <span className="flex w-[3.75rem] shrink-0 items-center justify-end gap-1 font-mono text-xs text-ink-3">
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
            {Math.round(row.projected)}
          </span>
        </>
      )}
    </div>
  );
}
