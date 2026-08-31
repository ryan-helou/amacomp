"use client";

import { useMemo, useState } from "react";
import { formatDay, type DayKey } from "@/lib/dates";
import { formatDuration, formatPace } from "@/lib/efforts";
import { bikeBlockedReason, recordsFor, type RecordEntry, type RecordRow } from "@/lib/pbs";
import { SPORT_UI } from "@/lib/ui";
import type { AppState, Athlete, Sport } from "@/lib/types";
import { Avatar } from "./Avatar";
import { SportMark } from "./SportMark";
import { AthleteName } from "./ProfileContext";

/**
 * The record book — the league's personal bests.
 *
 * Distinct from the Hall of Fame on Titles, which celebrates volume: biggest
 * week, most points in a day. This is about speed and power, computed from the
 * Strava streams behind each session rather than from the points.
 *
 * One sport at a time. Trying to show cycling's power curve, running's distance
 * ladder and swimming's together makes three unrelated tables fight for one
 * narrow screen, and they're never read at the same moment anyway.
 */

const SPORTS_WITH_RECORDS: Sport[] = ["bike", "run", "swim"];

/** How a row's number is written, which differs entirely by sport. */
function primaryValue(row: RecordRow, entry: RecordEntry): string {
  if (row.sport === "bike") return `${entry.value.toFixed(2)}`;
  return formatDuration(entry.value);
}

function secondaryValue(row: RecordRow, entry: RecordEntry): string {
  if (row.sport === "bike") return `${Math.round(entry.raw)} W`;
  return formatPace(entry.value, row.target, row.sport);
}

export function RecordsTab({
  state,
  refDay,
}: {
  state: AppState;
  refDay: DayKey;
}) {
  const [sport, setSport] = useState<Sport>("run");
  const [expanded, setExpanded] = useState<string | null>(null);
  // "Mine" narrows every row to the signed-in athlete's own mark. The league
  // view is the default because a record book is a comparison first.
  const [mineOnly, setMineOnly] = useState(false);

  const meId = state.me?.id ?? "";
  const byId = useMemo(() => {
    const m = new Map<string, Athlete>();
    for (const a of state.athletes) m.set(a.id, a);
    return m;
  }, [state.athletes]);

  // Current weights, so a W/kg record appears the moment someone fills theirs in
  // rather than waiting for their rides to be re-extracted.
  const weightById = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const a of state.athletes) m.set(a.id, a.weightKg);
    return m;
  }, [state.athletes]);

  const rows = useMemo(
    () => recordsFor(sport, state.efforts, state.settings.seasonStart, weightById),
    [sport, state.efforts, state.settings.seasonStart, weightById],
  );

  const blocked = useMemo(
    () => bikeBlockedReason(state.efforts, state.settings.seasonStart, weightById),
    [state.efforts, state.settings.seasonStart, weightById],
  );

  const ui = SPORT_UI[sport];
  const set = rows.filter((r) =>
    mineOnly ? r.entries.some((e) => e.athleteId === meId) : r.entries.length > 0,
  ).length;

  // Nothing has synced yet at all — a different message from "nobody has run a
  // marathon", and a much more likely one in the first hours after launch.
  const nothingSynced = state.efforts.length === 0;

  return (
    <div className="space-y-4">
      {/* ── Sport switcher ─────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Record book"
        className="flex gap-1 rounded-xl pane border border-line bg-tile p-1"
      >
        {SPORTS_WITH_RECORDS.map((s) => {
          const on = s === sport;
          const sui = SPORT_UI[s];
          return (
            <button
              key={s}
              role="tab"
              aria-selected={on}
              onClick={() => {
                setSport(s);
                setExpanded(null);
              }}
              className={`eyebrow flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 transition-colors ${
                on ? `${sui.bg} text-white` : "text-ink-2"
              }`}
            >
              <SportMark sport={s} className="h-4 w-4" />
              {sui.label}
            </button>
          );
        })}
      </div>

      {/* ── What this book is, and how full it is ──────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8125rem] text-ink-2">
          {sport === "bike"
            ? "Best watts per kilo held for each duration."
            : `Fastest ${ui.label.toLowerCase()} over each distance.`}{" "}
          <span className="text-ink-3">Since kickoff.</span>
        </p>
        <button
          type="button"
          onClick={() => setMineOnly((v) => !v)}
          aria-pressed={mineOnly}
          className={`eyebrow shrink-0 rounded-lg border px-3 py-1.5 transition-colors ${
            mineOnly ? "border-ink bg-ink text-on-ink" : "border-line bg-tile text-ink-2"
          }`}
        >
          Mine
        </button>
      </div>

      <p className="font-mono text-xs text-ink-3">
        {set} of {rows.length} set
      </p>

      {/* ── Why cycling might be empty ─────────────────────────────── */}
      {sport === "bike" && blocked && (
        <div className="rounded-xl pane border border-line bg-tile px-4 py-3">
          <p className="text-[0.8125rem] text-ink-2">
            {blocked === "no-power" ? (
              <>
                No rides with power yet. Watts per kilo needs a power meter — Strava
                only sends a watts stream when the ride was recorded with one, and
                guessing it from speed would invent records nobody set.
              </>
            ) : (
              <>
                Power is coming through, but there&apos;s no body weight to divide it
                by. Add yours in settings and these fill in.
              </>
            )}
          </p>
        </div>
      )}

      {nothingSynced && (
        <div className="rounded-xl pane border border-line bg-tile px-4 py-3">
          <p className="text-[0.8125rem] text-ink-2">
            Nothing pulled in yet. Bests are read from the Strava session behind each
            log, a few at a time, so the book fills itself in over the next few hours.
          </p>
        </div>
      )}

      {/* ── The book ───────────────────────────────────────────────── */}
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const entries = mineOnly
            ? row.entries.filter((e) => e.athleteId === meId)
            : row.entries;
          const leader = entries[0];
          const open = expanded === row.key;
          const mine = row.entries.find((e) => e.athleteId === meId);
          // Where the athlete sits on a row they don't lead — the whole reason to
          // look at someone else's record.
          const myRank = mine ? row.entries.indexOf(mine) + 1 : 0;

          return (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : row.key)}
                aria-expanded={open}
                disabled={entries.length === 0}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                  leader
                    ? "border-line bg-tile active:bg-tile/70"
                    : "border-dashed border-line/70 bg-transparent"
                }`}
              >
                {/* The target, in a fixed column so the ladder reads down the page. */}
                <span className="eyebrow w-[4.5rem] shrink-0 text-ink">{row.label}</span>

                {leader ? (
                  <>
                    <Avatar
                      athlete={byId.get(leader.athleteId) ?? fallbackAthlete(leader.athleteId)}
                      me={leader.athleteId === meId}
                      className="h-7 w-7 shrink-0 text-[0.625rem]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-2">
                        <AthleteName
                          id={leader.athleteId}
                          name={byId.get(leader.athleteId)?.name ?? "—"}
                        />
                      </span>
                      {/* Which session it came off. A record reads completely
                          differently when you can see it was set on "Brutal
                          interval" rather than on a bare date. */}
                      <span className="block truncate text-[0.6875rem] text-ink-3">
                        {leader.name || formatDay(leader.occurredOn)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`block font-mono text-base font-semibold ${ui.text}`}>
                        {primaryValue(row, leader)}
                        {row.sport === "bike" && (
                          <span className="text-[0.6875rem] font-normal text-ink-3"> W/kg</span>
                        )}
                      </span>
                      <span className="block font-mono text-[0.6875rem] text-ink-3">
                        {secondaryValue(row, leader)}
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="flex-1 text-sm text-ink-3">
                    {mineOnly ? "You haven't set this one" : "No one yet"}
                  </span>
                )}
              </button>

              {/* ── Everyone else on this row ─────────────────────────── */}
              {open && entries.length > 0 && (
                <ol className="mt-1 space-y-1 rounded-xl border border-line bg-deck-2/40 px-3.5 py-2.5">
                  {entries.map((entry, i) => (
                    <li
                      key={entry.athleteId}
                      className="flex items-center gap-2.5 py-1"
                    >
                      <span className="w-4 shrink-0 font-mono text-xs text-ink-3">
                        {i + 1}
                      </span>
                      <Avatar
                        athlete={byId.get(entry.athleteId) ?? fallbackAthlete(entry.athleteId)}
                        me={entry.athleteId === meId}
                        className="h-6 w-6 shrink-0 text-[0.5625rem]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] text-ink-2">
                          <AthleteName
                            id={entry.athleteId}
                            name={byId.get(entry.athleteId)?.name ?? "—"}
                          />
                        </span>
                        <span className="block truncate text-[0.6875rem] text-ink-3">
                          {entry.name ? `${entry.name} · ` : ""}
                          {formatDay(entry.occurredOn)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-mono text-[0.8125rem] text-ink">
                          {primaryValue(row, entry)}
                          {row.sport === "bike" && (
                            <span className="text-[0.625rem] font-normal text-ink-3"> W/kg</span>
                          )}
                        </span>
                        {/* Watts, because W/kg alone is unreadable as a number
                            you can compare to anything you know. */}
                        <span className="block font-mono text-[0.625rem] text-ink-3">
                          {secondaryValue(row, entry)}
                        </span>
                      </span>
                    </li>
                  ))}
                  {!mineOnly && myRank > 1 && (
                    <li className="border-t border-line pt-2 text-[0.75rem] text-ink-3">
                      You&apos;re {ordinal(myRank)} on this one.
                    </li>
                  )}
                </ol>
              )}
            </li>
          );
        })}
      </ul>

      <p className="pt-1 text-center text-[0.6875rem] leading-relaxed text-ink-3">
        Read from the Strava session behind each log — hand-entered sessions carry no
        splits, so they can&apos;t set a record. Only sessions since kickoff count.
      </p>
      <p className="sr-only">Showing records as of {formatDay(refDay)}.</p>
    </div>
  );
}

/** An athlete who left the league, or a stale id — never crash a board over it. */
function fallbackAthlete(id: string): Athlete {
  return {
    id, name: "—", weightKg: null,
    avatarColor: null, avatarGlyph: null, avatarUrl: null,
  };
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
