"use client";

import { useState } from "react";
import { missedBibleDays } from "@/lib/bible";
import { activityPoints, fmtPoints } from "@/lib/scoring";
import { formatDay, type DayKey } from "@/lib/dates";
import type { League } from "./useLeague";

/**
 * The days you're losing points to the Bible box, today included, each one
 * tickable here. Ryan, 2026-11-13 (past days) and 2026-11-16 (today too).
 * Hidden when there's nothing to catch up on.
 */
export function BibleMissed({ league, logDay }: { league: League; logDay: DayKey }) {
  const { state, send, busy } = league;
  const [error, setError] = useState<string | null>(null);
  const me = state.me;
  if (!me) return null;

  const days = missedBibleDays(state.activities, me.id, logDay, (a) =>
    activityPoints(a, state.settings),
  );
  if (days.length === 0) return null;

  async function tick(day: string) {
    setError(null);
    const err = await send("/api/session", {
      method: "PATCH",
      body: JSON.stringify({ bibleRead: true, bibleDay: day }),
    });
    if (err) setError(err);
  }

  return (
    <div className="mt-4 rounded-xl pane border border-gold/60 bg-tile px-4 py-3">
      <p className="eyebrow text-ink">Missed Bible days</p>
      <p className="mt-0.5 text-[0.8125rem] text-ink-2">
        Days your sessions are scoring 0 because the box isn&apos;t ticked. Read that day? Tick it.
      </p>
      <ul className="mt-3 space-y-2">
        {days.map((d) => (
          <li key={d.day}>
            <button
              type="button"
              role="checkbox"
              aria-checked={false}
              disabled={busy}
              onClick={() => tick(d.day)}
              className="flex w-full items-center gap-3 rounded-lg border border-line-2 bg-deck-2 px-3 py-2.5 text-left disabled:opacity-60"
            >
              <span aria-hidden className="h-5 w-5 shrink-0 rounded-md border-2 border-ink-3" />
              <span className="min-w-0 flex-1 text-[0.875rem] font-semibold text-ink">
                {d.day === logDay ? `Today · ${formatDay(d.day as DayKey)}` : formatDay(d.day as DayKey)}
              </span>
              <span className="shrink-0 font-mono text-xs text-gold">
                +{fmtPoints(d.points)} pts
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-[0.75rem] text-run">{error}</p>}
    </div>
  );
}
