"use client";

import { useState } from "react";
import { bibleApplies, hasRead } from "@/lib/bible";
import { activityPoints, fmtPoints } from "@/lib/scoring";
import type { DayKey } from "@/lib/dates";
import type { League } from "./useLeague";
import { BibleCross } from "./FestiveScenes";

/**
 * "I read the Bible today" — the box every session's points hang on
 * (lib/bible). It sits at the top of the Week tab because a box you have to go
 * looking for is a box you forget, and forgetting it costs the whole day.
 */
export function BibleCheck({ league, logDay }: { league: League; logDay: DayKey }) {
  const { state, send, busy } = league;
  const [error, setError] = useState<string | null>(null);
  const me = state.me;
  if (!me || !bibleApplies(logDay)) return null;

  const read = hasRead(state.bibleDays, me.id, logDay);
  // What today's sessions would score with the box ticked — the cost of
  // leaving it, said in points rather than in principle.
  const waiting = state.activities
    .filter((a) => a.athleteId === me.id && a.occurredOn === logDay && a.bibleMissing)
    .reduce((sum, a) => sum + activityPoints({ ...a, bibleMissing: false }, state.settings), 0);

  async function toggle() {
    setError(null);
    const err = await send("/api/session", {
      method: "PATCH",
      body: JSON.stringify({ bibleRead: !read, bibleDay: logDay }),
    });
    if (err) setError(err);
  }

  return (
    <div className="mt-4 w-full">
      <button
        type="button"
        role="checkbox"
        aria-checked={read}
        disabled={busy}
        onClick={toggle}
        className={`flex w-full items-center gap-3 rounded-xl pane border px-4 py-3 text-left transition-colors disabled:opacity-60 ${
          read ? "border-good/50 bg-good/10" : "border-gold/60 bg-tile"
        }`}
      >
        <span
          aria-hidden
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
            read ? "border-good bg-good text-on-accent" : "border-ink-3"
          }`}
        >
          {read && (
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-ink">I read the Bible today<BibleCross /></span>
          <span className="block text-[0.75rem] text-ink-3">
            {read
              ? "Today's sessions count."
              : waiting > 0
                ? `${fmtPoints(waiting)} pts from today are waiting on this.`
                : "Nothing you log today scores until this is ticked."}
          </span>
        </span>
      </button>
      {error && <p className="mt-2 text-center text-[0.75rem] text-run">{error}</p>}
    </div>
  );
}
