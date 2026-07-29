"use client";

import { useMemo } from "react";
import { activityPoints, fmtKm, fmtPoints } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { formatDayRelative, type DayKey } from "@/lib/dates";
import type { Activity, AppState } from "@/lib/types";
import { SportMark } from "./SportMark";

const PAGE = 60;

export function FeedTab({ state, refDay }: { state: AppState; refDay: DayKey }) {
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of state.athletes) map.set(a.id, a.name);
    return map;
  }, [state.athletes]);

  const days = useMemo(() => {
    const groups = new Map<DayKey, Activity[]>();
    for (const a of state.activities.slice(0, PAGE)) {
      const list = groups.get(a.occurredOn);
      if (list) list.push(a);
      else groups.set(a.occurredOn, [a]);
    }
    return [...groups.entries()];
  }, [state.activities]);

  if (days.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-line px-4 py-12 text-center text-sm text-ink-2">
        Quiet so far. The feed fills up as everyone logs.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {days.map(([day, items]) => {
        const dayPoints = items.reduce(
          (sum, a) => sum + activityPoints(a, state.settings),
          0,
        );
        return (
          <section key={day}>
            <div className="flex items-baseline justify-between border-b-2 border-ink pb-1.5">
              <h2 className="eyebrow text-ink">{formatDayRelative(day, refDay)}</h2>
              <span className="font-mono text-xs text-ink-2">
                {fmtPoints(dayPoints)} pts
              </span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {items.map((a) => {
                const ui = SPORT_UI[a.sport];
                const isMe = a.athleteId === state.me?.id;
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl bg-tile px-3 py-2.5"
                  >
                    <span className={ui.text}>
                      <SportMark sport={a.sport} className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
                        <span className="font-semibold">
                          {names.get(a.athleteId) ?? "Unknown"}
                        </span>
                        {isMe && <span className="text-ink-3"> · you</span>}
                        <span className="text-ink-2">
                          {" "}
                          — {fmtKm(a.km)} km {ui.label.toLowerCase()}
                        </span>
                      </p>
                      {a.note && (
                        <p className="truncate text-[0.8125rem] text-ink-3">{a.note}</p>
                      )}
                    </div>
                    <span className={`stamp shrink-0 text-base ${ui.text}`}>
                      {fmtPoints(activityPoints(a, state.settings))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {state.activities.length > PAGE && (
        <p className="text-center font-mono text-xs text-ink-3">
          Showing the most recent {PAGE} sessions.
        </p>
      )}
    </div>
  );
}
