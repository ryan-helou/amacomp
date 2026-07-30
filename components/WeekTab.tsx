"use client";

import { useMemo, useState } from "react";
import { fmtPoints, standingsFor } from "@/lib/scoring";
import { addDays, formatRange, periodRange, weekStart, type DayKey } from "@/lib/dates";
import type { AppState } from "@/lib/types";
import {
  headToHead,
  lastWeekRecap,
  movementByAthlete,
  streakFor,
} from "@/lib/achievements";
import { PaceClock } from "./PaceClock";
import { Glyph } from "./Glyph";
import { Avatar } from "./Avatar";
import { AthleteName } from "./ProfileContext";

export function WeekTab({ state, refDay }: { state: AppState; refDay: DayKey }) {
  // Athletes want to look at where they finished a past week — a leaderboard's
  // no fun if it evaporates on Monday. Nav is local to this tab; the rest of
  // the app keeps tracking "today" from AppShell's refDay.
  const currentWeekStart = weekStart(refDay);
  const [weekRef, setWeekRef] = useState<DayKey>(refDay);
  const viewedWeekStart = weekStart(weekRef);
  const isCurrentWeek = viewedWeekStart === currentWeekStart;
  const canGoForward = viewedWeekStart < currentWeekStart;
  const weekOffset = Math.round(
    (Date.parse(viewedWeekStart) - Date.parse(currentWeekStart)) / (7 * 86400_000),
  );
  const weekLabel =
    weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : `${-weekOffset} weeks ago`;

  const standings = useMemo(
    () => standingsFor(state.athletes, state.activities, state.settings, "week", weekRef),
    [state.athletes, state.activities, state.settings, weekRef],
  );

  const meId = state.me?.id ?? "";
  const mine = standings.find((s) => s.athlete.id === meId);
  const goal = state.settings.weeklyGoal;
  const range = periodRange("week", weekRef);
  const met = standings.filter((s) => s.points >= goal).length;

  const streak = useMemo(
    () => streakFor(meId, state.activities, state.settings, refDay),
    [meId, state.activities, state.settings, refDay],
  );
  const h2h = useMemo(() => headToHead(standings, meId), [standings, meId]);
  const myMove = useMemo(
    () => movementByAthlete(state.athletes, state.activities, state.settings, refDay).get(meId),
    [state.athletes, state.activities, state.settings, refDay, meId],
  );
  const recap = useMemo(
    () => lastWeekRecap(state.athletes, state.activities, state.settings, refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );

  // These lean on "right now" (streaks, since-yesterday movement, last-week
  // recap under the current week) so they only make sense on the current view.
  const passed = isCurrentWeek ? myMove?.passed ?? [] : [];
  const showStreak = isCurrentWeek && streak.current > 0;
  const showRecap = isCurrentWeek && recap;

  return (
    <div className="space-y-7">
      <section className="flex flex-col items-center">
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={() => setWeekRef(addDays(viewedWeekStart, -1))}
            aria-label="Previous week"
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-line bg-tile text-ink-2 active:bg-tile/70"
          >
            <Chevron dir="left" />
          </button>
          <div className="text-center">
            <p className="eyebrow text-ink-2">{weekLabel}</p>
            <p className="mt-1 font-mono text-xs text-ink-3">{formatRange(range)}</p>
          </div>
          <button
            type="button"
            onClick={() => setWeekRef(addDays(viewedWeekStart, 7))}
            aria-label="Next week"
            disabled={!canGoForward}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-line bg-tile text-ink-2 active:bg-tile/70 disabled:opacity-30"
          >
            <Chevron dir="right" />
          </button>
        </div>

        <div className="mt-5">
          <PaceClock bySport={mine?.bySport} goal={goal} size={216} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {showStreak && (
            <span className="eyebrow inline-flex items-center gap-1.5 rounded-full bg-run/10 px-3 py-1.5 text-run">
              <Glyph name="flame" className="h-3.5 w-3.5" />
              {streak.current}-week streak
            </span>
          )}
          {mine && mine.rank >= 1 && mine.points > 0 && (
            <span className="eyebrow rounded-full bg-tile px-3 py-1.5 text-ink-2 ring-1 ring-line">
              {mine.rank === 1 ? (isCurrentWeek ? "Leading" : "Won the week") : `#${mine.rank} of ${standings.length}`}
            </span>
          )}
        </div>

        {passed.length > 0 && (
          <p className="mt-3 text-center text-sm font-medium text-good">
            ↑ You overtook {listNames(passed)} since yesterday
          </p>
        )}
        {passed.length === 0 && (
          <p className="mt-3 text-center text-sm text-ink-2">
            {mine && mine.points >= goal ? (
              isCurrentWeek ? (
                <>
                  You&apos;re through the quota with{" "}
                  <span className="font-semibold text-ink">{fmtPoints(mine.points - goal)}</span> to spare.
                </>
              ) : (
                <>
                  Cleared quota by{" "}
                  <span className="font-semibold text-ink">{fmtPoints(mine.points - goal)} pts</span>.
                </>
              )
            ) : isCurrentWeek ? (
              <>
                Quota is <span className="font-semibold text-ink">{fmtPoints(goal)} pts</span> by Sunday night.
              </>
            ) : (
              <>
                {mine && mine.points > 0 ? (
                  <>
                    Finished{" "}
                    <span className="font-semibold text-ink">{fmtPoints(goal - mine.points)} pts</span> short of quota.
                  </>
                ) : (
                  <>No sessions logged this week.</>
                )}
              </>
            )}
          </p>
        )}
      </section>

      {h2h && (
        <section className="rounded-2xl border-2 border-ink bg-tile p-4">
          <p className="eyebrow text-ink-2">
            {h2h.leading ? "Chasing you" : "Right ahead of you"}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">You</div>
              <div className="stamp text-2xl accent-text">{fmtPoints(h2h.me.points)}</div>
            </div>
            <div className="text-center">
              <div
                className={`stamp text-lg ${h2h.leading ? "text-good" : "text-run"}`}
              >
                {h2h.leading ? "+" : "−"}
                {fmtPoints(Math.abs(h2h.diff))}
              </div>
              <div className="eyebrow text-ink-3">{h2h.leading ? "ahead" : "behind"}</div>
            </div>
            <div className="min-w-0 flex-1 text-right">
              <div className="truncate text-sm font-semibold text-ink">
                <AthleteName id={h2h.rival.athlete.id} name={h2h.rival.athlete.name} />
              </div>
              <div className="stamp text-2xl text-ink-2">{fmtPoints(h2h.rival.points)}</div>
            </div>
          </div>
          {!h2h.leading && h2h.diff < 0 && (
            <p className="mt-2 text-center text-xs text-ink-2">
              {fmtPoints(Math.abs(h2h.diff))} pts to take the spot.
            </p>
          )}
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow text-ink-2">Everyone</h2>
          <span className="font-mono text-xs text-ink-3">
            {met}/{standings.length} through
          </span>
        </div>

        <ul className="mt-3 space-y-2">
          {standings.map((row) => {
            const pct = Math.min(row.goalProgress, 1) * 100;
            const done = row.points >= goal;
            const isMe = row.athlete.id === meId;
            return (
              <li
                key={row.athlete.id}
                className={`rounded-xl border-2 bg-tile px-3 py-2.5 ${
                  isMe ? "border-ink" : "border-line"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar athlete={row.athlete} me={isMe} className="h-8 w-8 text-[0.625rem]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <AthleteName
                        id={row.athlete.id}
                        name={row.athlete.name}
                        className="truncate text-sm font-semibold text-ink"
                      />
                      <span className="font-mono text-xs text-ink-2">
                        <span className="text-ink">{fmtPoints(row.points)}</span>
                        <span className="text-ink-3">/{fmtPoints(goal)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-deck-2">
                      <div
                        className={done ? "h-full bg-good" : "h-full accent-fill"}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  {done && (
                    <span className="eyebrow shrink-0 rounded-md bg-good/12 px-2 py-1 text-good">
                      Met
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {showRecap && recap && (
        <section className="rounded-2xl border-2 border-gold/40 bg-gold/5 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow text-gold">Last week</h2>
            <span className="font-mono text-xs text-ink-3">{recap.rangeLabel}</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-gold" aria-hidden>
              <Glyph name="trophy" className="h-7 w-7" />
            </span>
            <div className="flex-1">
              <div className="text-sm text-ink-2">Champion</div>
              <div className="stamp text-xl text-ink">
                <AthleteName id={recap.champion.athlete.id} name={recap.champion.athlete.name} />
              </div>
            </div>
            <div className="text-right">
              <div className="stamp text-xl text-gold">{fmtPoints(recap.champion.points)}</div>
              <div className="eyebrow text-ink-3">pts</div>
            </div>
          </div>
          {recap.missed.length > 0 && (
            <div className="mt-3 border-t border-gold/20 pt-2 text-xs text-ink-2">
              <p>
                <span className="font-semibold text-ink">Missed quota:</span>{" "}
                {listNames(recap.missed.map((s) => s.athlete.name))}.
              </p>
              <p className="mt-1">
                <span className="font-semibold text-run">Forfeit:</span>{" "}
                {state.settings.forfeit}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      {dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}

function listNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
