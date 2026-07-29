"use client";

import { useMemo, useState } from "react";
import { fmtPoints } from "@/lib/scoring";
import { initials } from "@/lib/ui";
import type { AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import { monthlyChampions, weekWinsBoard } from "@/lib/achievements";
import { AthleteSheet } from "./AthleteSheet";
import { Glyph } from "./Glyph";

export function TitlesTab({ state, refDay }: { state: AppState; refDay: DayKey }) {
  const [selected, setSelected] = useState<string | null>(null);

  const wins = useMemo(
    () => weekWinsBoard(state.athletes, state.activities, state.settings, refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );
  const months = useMemo(
    () => monthlyChampions(state.athletes, state.activities, state.settings, refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );

  const anyWins = wins.some((w) => w.wins > 0);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="eyebrow text-ink-2">Most week wins</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          Every completed week crowns a champion. This is the all-time count.
        </p>

        {!anyWins ? (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
            No weeks in the books yet. The first champion is crowned when this week
            closes.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {wins.map((row) => {
              const isMe = row.athlete.id === state.me?.id;
              const has = row.wins > 0;
              return (
                <li key={row.athlete.id}>
                  <button
                    onClick={() => setSelected(row.athlete.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left ${
                      isMe ? "border-ink bg-tile" : "border-line bg-tile"
                    }`}
                  >
                    <span
                      className={`stamp w-6 text-center text-xl ${
                        row.rank === 1 && has ? "text-gold" : "text-ink-3"
                      }`}
                    >
                      {has ? row.rank : "—"}
                    </span>
                    <span
                      aria-hidden
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[0.6875rem] font-bold ${
                        isMe ? "border-ink bg-ink text-tile" : "border-line text-ink-2"
                      }`}
                    >
                      {initials(row.athlete.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">
                      {row.athlete.name}
                      {isMe && <span className="ml-1.5 text-xs font-normal text-ink-2">you</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-right">
                      {row.wins > 0 && (
                        <span className="text-gold">
                          <Glyph name="trophy" className="h-4 w-4" />
                        </span>
                      )}
                      <span className="font-mono text-sm text-ink-2">
                        {row.wins} win{row.wins === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section>
        <h2 className="eyebrow text-ink-2">Monthly champions</h2>
        {months.length === 0 ? (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
            The monthly hall of fame fills up as the months roll by.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {months.map((m) => (
              <li
                key={m.monthKey}
                className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${
                  m.isCurrent ? "border-accent/40 bg-accent/5" : "border-gold/40 bg-gold/5"
                }`}
              >
                <span className={m.isCurrent ? "text-accent" : "text-gold"} aria-hidden>
                  <Glyph name={m.isCurrent ? "flame" : "trophy"} className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="eyebrow text-ink-2">{m.label}</span>
                    {m.isCurrent && (
                      <span className="eyebrow rounded bg-accent/12 px-1.5 py-0.5 text-[0.5625rem] accent-text">
                        Leading
                      </span>
                    )}
                  </div>
                  <div className="stamp text-lg text-ink">{m.champion.athlete.name}</div>
                </div>
                <div className="text-right">
                  <div className={`stamp text-lg ${m.isCurrent ? "accent-text" : "text-gold"}`}>
                    {fmtPoints(m.champion.points)}
                  </div>
                  <div className="eyebrow text-ink-3">pts</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <AthleteSheet
          state={state}
          athleteId={selected}
          refDay={refDay}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
