"use client";

import { useMemo, useState } from "react";
import { fmtKm, fmtPoints } from "@/lib/scoring";
import type { AppState } from "@/lib/types";
import { hallOfFame, type HallGroup } from "@/lib/records";
import { Glyph } from "./Glyph";
import { Avatar } from "./Avatar";
import { SportMark } from "./SportMark";
import { RecordSheet } from "./RecordSheet";

/**
 * The Hall of Fame — all-time VOLUME records: biggest week, most points in a
 * day. It shares a tab with the record book (speed and power from Strava
 * streams), switched by the toggle at the top of that tab; the two answer the
 * same question — "what's the best anyone has done?" — in different units.
 */
export function HallOfFame({ state }: { state: AppState }) {
  const [openRecord, setOpenRecord] = useState<string | null>(null);
  const [showUnclaimed, setShowUnclaimed] = useState(false);
  // Which record's ranking is open. Tapping a record shows who else has a mark
  // on it — the same move as the record book, so the two read the same way.
  const [openRanking, setOpenRanking] = useState<string | null>(null);

  const athleteById = useMemo(
    () => new Map(state.athletes.map((a) => [a.id, a])),
    [state.athletes],
  );
  const records = useMemo(
    () => hallOfFame(state.activities, state.settings),
    [state.activities, state.settings],
  );
  const shownRecords = useMemo(() => records.filter((r) => r.holderId), [records]);
  const unclaimed = useMemo(() => records.filter((r) => !r.holderId), [records]);

  const groups = useMemo(() => {
    const order: { id: HallGroup; label: string }[] = [
      { id: "points", label: "Points" },
      { id: "distance", label: "Distance" },
      { id: "volume", label: "Volume" },
      { id: "consistency", label: "Consistency" },
    ];
    return order
      .map((g) => ({ ...g, records: shownRecords.filter((r) => r.group === g.id) }))
      .filter((g) => g.records.length > 0);
  }, [shownRecords]);

  return (
    <div className="space-y-5">
      <p className="text-[0.8125rem] text-ink-2">
        All-time records. Beat one and your name goes up.
      </p>

      {groups.map((g) => (
        <section key={g.id}>
          <h3 className="eyebrow text-ink-3">{g.label}</h3>
          {/* One card per shelf, hairline-divided: eighteen separately bordered
              gold boxes in a column was the thing that read as clutter. */}
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl pane border border-line bg-tile">
            {g.records.map((r) => {
              const holder = r.holderId ? athleteById.get(r.holderId) : null;
              const shown = r.unit === "km" ? fmtKm(r.value) : fmtPoints(r.value);
              const open = openRanking === r.key;
              return (
                <li key={r.key}>
                  <button
                    onClick={() => setOpenRanking(open ? null : r.key)}
                    aria-expanded={open}
                    aria-label={`Rankings for ${r.label}`}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                  >
                    <span className="shrink-0 text-gold">
                      {r.sport ? (
                        <SportMark sport={r.sport} className="h-5 w-5" />
                      ) : r.glyph ? (
                        <Glyph name={r.glyph} className="h-5 w-5" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-medium text-ink">
                        {r.label}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        {holder && <Avatar athlete={holder} className="h-4 w-4 text-[0.4375rem]" />}
                        <span className="truncate text-xs text-ink-2">{holder?.name ?? "—"}</span>
                        <span className="shrink-0 font-mono text-[0.625rem] text-ink-3">
                          {r.detail}
                        </span>
                      </span>
                    </span>
                    {/* Fixed width and tabular figures, so every mark on a shelf
                        lines up instead of drifting with the number's length. */}
                    <span className="w-[5.25rem] shrink-0 text-right tabular-nums">
                      <span className="stamp block text-lg leading-none text-gold">{shown}</span>
                      {/* Small enough that "sessions" still fits the column — the
                          unit is a footnote to the number, not a second number. */}
                      <span className="eyebrow block text-[0.5rem] tracking-[0.08em] text-ink-3">
                        {r.unit}
                      </span>
                    </span>
                    {/* Same disclosure caret as the Week lanes, so the rows
                        read as openable the way the rest of the app does. */}
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {open && (
                    <ol className="space-y-1 border-t border-line bg-deck-2/40 px-3.5 py-2.5">
                      {r.entries.map((e, i) => {
                        const who = athleteById.get(e.athleteId);
                        const v = r.unit === "km" ? fmtKm(e.value) : fmtPoints(e.value);
                        return (
                          <li key={e.athleteId} className="flex items-center gap-2.5 py-1">
                            <span className="w-4 shrink-0 font-mono text-xs text-ink-3">{i + 1}</span>
                            {who && (
                              <Avatar athlete={who} className="h-6 w-6 shrink-0 text-[0.5625rem]" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[0.8125rem] text-ink-2">
                                {who?.name ?? "—"}
                              </span>
                              <span className="block truncate font-mono text-[0.625rem] text-ink-3">
                                {e.detail}
                              </span>
                            </span>
                            <span className="w-[5.25rem] shrink-0 text-right font-mono text-[0.8125rem] tabular-nums text-ink">
                              {v}
                            </span>
                          </li>
                        );
                      })}
                      {/* The record sheet still lives here — it explains the top
                          mark, which is a different question from who else has one. */}
                      <li className="border-t border-line pt-2">
                        <button
                          onClick={() => setOpenRecord(r.key)}
                          className="eyebrow text-[0.625rem] text-gold"
                        >
                          How {holder?.name} set it
                        </button>
                      </li>
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {/* Unclaimed records collapse into one line. On day one every record is
          unclaimed, and nine identical "go get it" rows is an empty shelf —
          this keeps it a trophy case that fills up, without hiding anything. */}
      {unclaimed.length > 0 && (
        <div>
          <button
            onClick={() => setShowUnclaimed((v) => !v)}
            aria-expanded={showUnclaimed}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-left"
          >
            <span className="eyebrow flex-1 text-ink-2">
              {unclaimed.length} record{unclaimed.length === 1 ? "" : "s"} up for grabs
            </span>
            <span className="eyebrow text-ink-3">{showUnclaimed ? "Hide" : "Show"}</span>
          </button>
          {showUnclaimed && (
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl pane border border-line bg-tile">
              {unclaimed.map((r) => (
                <li key={r.key} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="shrink-0 text-ink-3">
                    {r.sport ? (
                      <SportMark sport={r.sport} className="h-5 w-5" />
                    ) : r.glyph ? (
                      <Glyph name={r.glyph} className="h-5 w-5" />
                    ) : null}
                  </span>
                  <span className="flex-1 truncate text-[0.8125rem] text-ink-2">{r.label}</span>
                  <span className="eyebrow shrink-0 text-ink-3">{r.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {openRecord &&
        (() => {
          const r = records.find((x) => x.key === openRecord);
          if (!r) return null;
          return (
            <RecordSheet record={r} state={state} onClose={() => setOpenRecord(null)} />
          );
        })()}
    </div>
  );
}
