"use client";

import { useMemo, useState } from "react";
import {
  SPORT_ORDER,
  fmtKm,
  fmtPoints,
  standingsFor,
  type Standing,
} from "@/lib/scoring";
import { SPORT_UI, initials } from "@/lib/ui";
import { PERIODS, formatRange, periodRange, type DayKey, type Period } from "@/lib/dates";
import { SPORT_UNIT, rateLabel, type AppState } from "@/lib/types";
import { championshipsByAthlete, movementByAthlete } from "@/lib/achievements";
import { AthleteSheet } from "./AthleteSheet";
import { Glyph } from "./Glyph";

/**
 * The leaderboard is a pool: one lane per athlete, lane 1 for the leader, and a
 * lane rope between each. The bar in every lane is split by discipline, so you
 * can see at a glance whether someone is winning on swim volume or bike volume.
 */
export function BoardTab({ state, refDay }: { state: AppState; refDay: DayKey }) {
  const [period, setPeriod] = useState<Period>("week");
  const [selected, setSelected] = useState<string | null>(null);

  const standings = useMemo(
    () => standingsFor(state.athletes, state.activities, state.settings, period, refDay),
    [state.athletes, state.activities, state.settings, period, refDay],
  );

  const titles = useMemo(
    () => championshipsByAthlete(state.athletes, state.activities, state.settings, refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );
  const movement = useMemo(
    () => movementByAthlete(state.athletes, state.activities, state.settings, refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );

  const leader = standings[0];
  const top = leader?.points ?? 0;
  const range = periodRange(period, refDay);
  const anyPoints = standings.some((s) => s.points > 0);

  return (
    <div className="space-y-5">
      <div>
        <div
          role="tablist"
          aria-label="Leaderboard period"
          className="flex gap-1 rounded-xl border-2 border-line bg-tile p-1"
        >
          {PERIODS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={`eyebrow flex-1 rounded-lg py-2.5 transition-colors ${
                period === p.id ? "bg-ink text-tile" : "text-ink-2"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-center font-mono text-xs text-ink-3">
          {period === "all" ? "Every session ever logged" : formatRange(range)}
        </p>
      </div>

      {!anyPoints ? (
        <p className="rounded-2xl border-2 border-dashed border-line px-4 py-10 text-center text-sm text-ink-2">
          No points in this window yet. The lanes fill as sessions come in.
        </p>
      ) : (
        <ol className="space-y-0">
          {standings.map((row, i) => (
            <li key={row.athlete.id}>
              {i > 0 && <div className="lane-rope my-1" />}
              <Lane
                row={row}
                top={top}
                isMe={row.athlete.id === state.me?.id}
                index={i}
                titles={titles.get(row.athlete.id) ?? 0}
                delta={period === "week" ? movement.get(row.athlete.id)?.delta ?? 0 : 0}
                onSelect={() => setSelected(row.athlete.id)}
              />
            </li>
          ))}
        </ol>
      )}

      <p className="pt-1 text-center font-mono text-xs text-ink-3">
        {SPORT_ORDER.map(
          (s) =>
            `${SPORT_UI[s].label.toLowerCase()} ${rateLabel(state.settings.multipliers[s], SPORT_UNIT[s])}`,
        ).join("  ·  ")}
      </p>
      <p className="text-center text-[0.6875rem] text-ink-3">Tap a lane for badges &amp; stats</p>

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

function Lane({
  row,
  top,
  isMe,
  index,
  titles,
  delta,
  onSelect,
}: {
  row: Standing;
  top: number;
  isMe: boolean;
  index: number;
  titles: number;
  delta: number;
  onSelect: () => void;
}) {
  const width = top > 0 ? Math.max(row.points / top, 0) : 0;
  const scored = row.points > 0;

  return (
    <button
      onClick={onSelect}
      className={`lane-enter block w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
        isMe ? "bg-tile ring-2 ring-ink" : "hover:bg-tile/60"
      }`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className="flex w-8 shrink-0 flex-col items-center">
          <span
            className={`stamp text-2xl ${
              row.rank === 1 && scored ? "text-gold" : "text-ink-3"
            }`}
          >
            {scored ? row.rank : "—"}
          </span>
          {delta !== 0 ? (
            <span
              className={`font-mono text-[0.5rem] font-bold ${
                delta > 0 ? "text-good" : "text-run"
              }`}
            >
              {delta > 0 ? `▲${delta}` : `▼${-delta}`}
            </span>
          ) : (
            <span className="eyebrow text-[0.5rem] text-ink-3">lane</span>
          )}
        </div>

        <div
          aria-hidden
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[0.6875rem] font-bold ${
            isMe ? "border-ink bg-ink text-tile" : "border-line bg-tile text-ink-2"
          }`}
        >
          {initials(row.athlete.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[0.9375rem] font-semibold text-ink">
              {row.athlete.name}
              {titles > 0 && (
                <span className="ml-1.5 inline-flex items-baseline gap-0.5 align-baseline text-xs font-normal text-gold">
                  <Glyph name="trophy" className="h-3.5 w-3.5 translate-y-0.5" />
                  {titles > 1 ? `×${titles}` : ""}
                </span>
              )}
              {isMe && <span className="ml-1.5 text-xs font-normal text-ink-2">you</span>}
            </span>
            <span className="stamp shrink-0 text-xl text-ink">
              {fmtPoints(row.points)}
            </span>
          </div>

          <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-deck-2">
            {scored &&
              SPORT_ORDER.map((sport) => {
                const share = row.bySport[sport] / row.points;
                if (share <= 0) return null;
                return (
                  <div
                    key={sport}
                    className={SPORT_UI[sport].bg}
                    style={{ width: `${share * width * 100}%` }}
                    title={`${SPORT_UI[sport].label}: ${fmtPoints(row.bySport[sport])} pts`}
                  />
                );
              })}
          </div>

          <div className="mt-1 flex gap-3 font-mono text-[0.6875rem] text-ink-3">
            {row.km > 0 && <span>{fmtKm(row.km)} km</span>}
            <span>
              {row.sessions} session{row.sessions === 1 ? "" : "s"}
            </span>
            {SPORT_ORDER.filter((s) => row.kmBySport[s] > 0).map((s) => (
              <span key={s} className={SPORT_UI[s].text}>
                {SPORT_UI[s].label[0]}
                {fmtKm(row.kmBySport[s])}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
