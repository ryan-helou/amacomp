"use client";

import { useMemo } from "react";
import { fmtPoints, standingsFor } from "@/lib/scoring";
import { initials } from "@/lib/ui";
import { formatRange, periodRange, type DayKey } from "@/lib/dates";
import type { AppState } from "@/lib/types";
import { PaceClock } from "./PaceClock";

export function WeekTab({ state, refDay }: { state: AppState; refDay: DayKey }) {
  const standings = useMemo(
    () => standingsFor(state.athletes, state.activities, state.settings, "week", refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );

  const mine = standings.find((s) => s.athlete.id === state.me?.id);
  const goal = state.settings.weeklyGoal;
  const range = periodRange("week", refDay);
  const met = standings.filter((s) => s.points >= goal).length;

  return (
    <div className="space-y-7">
      <section className="flex flex-col items-center">
        <p className="eyebrow text-ink-2">This week</p>
        <p className="mt-1 font-mono text-xs text-ink-3">{formatRange(range)}</p>
        <div className="mt-5">
          <PaceClock points={mine?.points ?? 0} goal={goal} size={216} />
        </div>
        <p className="mt-4 text-center text-sm text-ink-2">
          {mine && mine.points >= goal ? (
            <>
              You&apos;re through the quota with{" "}
              <span className="font-semibold text-ink">
                {fmtPoints(mine.points - goal)}
              </span>{" "}
              to spare.
            </>
          ) : (
            <>
              Quota is{" "}
              <span className="font-semibold text-ink">{fmtPoints(goal)} pts</span> by
              Sunday night.
            </>
          )}
        </p>
      </section>

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
            const isMe = row.athlete.id === state.me?.id;
            return (
              <li
                key={row.athlete.id}
                className={`rounded-xl border-2 bg-tile px-3 py-2.5 ${
                  isMe ? "border-ink" : "border-line"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[0.625rem] font-bold ${
                      isMe ? "border-ink bg-ink text-tile" : "border-line text-ink-2"
                    }`}
                  >
                    {initials(row.athlete.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {row.athlete.name}
                      </span>
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
    </div>
  );
}
