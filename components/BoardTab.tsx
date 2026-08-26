"use client";

import { useMemo, useState } from "react";
import {
  SPORT_ORDER,
  fmtKm,
  fmtPoints,
  standingsForRange,
  type Standing,
} from "@/lib/scoring";
import { SPORT_UI, GRANT_HATCH } from "@/lib/ui";
import { formatRange, periodRange, type DayKey, type Period } from "@/lib/dates";
import { SPORT_UNIT, elevationRateLabel, rateLabel, isGrant, type Athlete, type AppState, type Sport } from "@/lib/types";
import { championshipsByAthlete, movementByAthlete } from "@/lib/achievements";
import { firstSeason, seasonFor } from "@/lib/season";
import { useOpenProfile, useReigningChampion } from "./ProfileContext";
import { Glyph } from "./Glyph";
import { Avatar } from "./Avatar";
import { SportMark } from "./SportMark";

type SportFilter = Sport | "all";
type BoardPeriod = Period | "season";

// Season sits between Month and the all-time view; "All" is shortened so five
// tabs fit the row.
const PERIOD_TABS: { id: BoardPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "season", label: "Season" },
  { id: "all", label: "All" },
];

interface SportRow {
  athlete: Athlete;
  /** Kilometres for a distance sport; workout count for gym (each is 1 km). */
  value: number;
  sessions: number;
  rank: number;
}

/**
 * The leaderboard is a pool: one lane per athlete, lane 1 for the leader, and a
 * lane rope between each. "All" ranks by points across every discipline (the main
 * board); pick a single sport and it re-ranks by volume — kilometres, or workouts
 * for the gym — instead of points.
 */
export function BoardTab({ state, refDay }: { state: AppState; refDay: DayKey }) {
  const [period, setPeriod] = useState<BoardPeriod>("week");
  const [sport, setSport] = useState<SportFilter>("all");
  const openProfile = useOpenProfile();
  const reigning = useReigningChampion();

  const liveSeason = seasonFor(refDay, state.settings.seasonStart);
  const season = liveSeason ?? firstSeason(state.settings.seasonStart);

  // One date window drives everything, so the Season tab reuses the same
  // range-based standings as the calendar periods.
  const range = useMemo<[DayKey, DayKey]>(
    () => (period === "season" ? [season.start, season.end] : periodRange(period, refDay)),
    [period, refDay, season.start, season.end],
  );

  const standings = useMemo(
    () => standingsForRange(state.athletes, state.activities, state.settings, range),
    [state.athletes, state.activities, state.settings, range],
  );

  // Single-sport ranking by raw volume, computed straight from the activities so
  // it's independent of the points/cap system: km for distance, session count for
  // the flat gym discipline.
  const sportRanked = useMemo<SportRow[] | null>(() => {
    if (sport === "all") return null;
    const [from, to] = range;
    const agg = new Map<string, { athlete: Athlete; value: number; sessions: number }>();
    for (const a of state.athletes) agg.set(a.id, { athlete: a, value: 0, sessions: 0 });
    for (const act of state.activities) {
      if (isGrant(act)) continue;
      if (act.sport !== sport || act.occurredOn < from || act.occurredOn > to) continue;
      const r = agg.get(act.athleteId);
      if (!r) continue;
      r.value += act.km;
      r.sessions += 1;
    }
    const list = [...agg.values()].sort(
      (a, b) => b.value - a.value || a.athlete.name.localeCompare(b.athlete.name),
    );
    let rank = 0;
    let seen = 0;
    let prev: number | null = null;
    return list.map((r) => {
      seen += 1;
      if (prev === null || Math.abs(r.value - prev) > 1e-9) {
        rank = seen;
        prev = r.value;
      }
      return { ...r, rank };
    });
  }, [sport, range, state.athletes, state.activities]);

  const titles = useMemo(
    () => championshipsByAthlete(state.athletes, state.activities, state.settings, refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );
  const movement = useMemo(
    () => movementByAthlete(state.athletes, state.activities, state.settings, refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );

  const top = standings[0]?.points ?? 0;
  const anyPoints = standings.some((s) => s.points > 0);
  const sportTop = sportRanked?.[0]?.value ?? 0;
  const anySport = (sportRanked ?? []).some((r) => r.value > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <span className="eyebrow text-gold">{season.label}</span>
        <span className="font-mono text-xs text-ink-3">
          {season.monthsLabel}
          {liveSeason ? "" : " · opens soon"}
        </span>
      </div>
      <div>
        <div
          role="tablist"
          aria-label="Leaderboard period"
          className="flex gap-1 rounded-xl border-2 border-line bg-tile p-1"
        >
          {PERIOD_TABS.map((p) => (
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

        {/* Sport filter — "All" is the points board; a sport ranks by volume.
            Kept to one compact row: it's a second-order question next to the
            period, and stacked full-size tiles pushed the first athlete off
            the top of the screen. The selected sport is named underneath, so
            dropping the per-tile labels costs nothing. */}
        <div
          className="mt-2 flex items-center gap-1.5"
          role="tablist"
          aria-label="Discipline"
        >
          <button
            role="tab"
            aria-selected={sport === "all"}
            aria-label="All disciplines"
            onClick={() => setSport("all")}
            className={`flex h-9 flex-1 items-center justify-center rounded-lg border-2 transition-colors ${
              sport === "all" ? "border-ink bg-ink text-tile" : "border-line bg-tile text-ink-3"
            }`}
          >
            <Glyph name="trio" className="h-[18px] w-[18px]" />
          </button>
          {SPORT_ORDER.map((s) => {
            const on = sport === s;
            const ui = SPORT_UI[s];
            return (
              <button
                key={s}
                role="tab"
                aria-selected={on}
                aria-label={ui.label}
                onClick={() => setSport(s)}
                className={`flex h-9 flex-1 items-center justify-center rounded-lg border-2 transition-colors ${
                  on ? `${ui.border} ${ui.bg} text-white` : `border-line bg-tile ${ui.text}`
                }`}
              >
                <SportMark sport={s} className="h-[18px] w-[18px]" />
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-center font-mono text-xs text-ink-3">
          {sport !== "all" && (
            <span className={SPORT_UI[sport].text}>
              {SPORT_UI[sport].label} ·{" "}
            </span>
          )}
          {period === "all" ? "Every session ever logged" : formatRange(range)}
        </p>
      </div>

      {sport === "all" ? (
        !anyPoints ? (
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
                  champion={reigning === row.athlete.id}
                  onSelect={() => openProfile(row.athlete.id)}
                />
              </li>
            ))}
          </ol>
        )
      ) : !anySport ? (
        <p className="rounded-2xl border-2 border-dashed border-line px-4 py-10 text-center text-sm text-ink-2">
          No {SPORT_UI[sport].label.toLowerCase()} logged in this window yet.
        </p>
      ) : (
        <ol className="space-y-0">
          {(sportRanked ?? []).map((row, i) => (
            <li key={row.athlete.id}>
              {i > 0 && <div className="lane-rope my-1" />}
              <SportLane
                row={row}
                top={sportTop}
                sport={sport}
                isMe={row.athlete.id === state.me?.id}
                index={i}
                champion={reigning === row.athlete.id}
                onSelect={() => openProfile(row.athlete.id)}
              />
            </li>
          ))}
        </ol>
      )}

      <p className="pt-1 text-center font-mono text-xs text-ink-3">
        {SPORT_ORDER.map((s) => {
          const climb = elevationRateLabel(state.settings.elevationPer100m?.[s] ?? 0);
          return `${SPORT_UI[s].label.toLowerCase()} ${rateLabel(state.settings.multipliers[s], SPORT_UNIT[s])}${climb ? ` +${climb}` : ""}`;
        }).join("  ·  ")}
      </p>
      <p className="text-center text-[0.6875rem] text-ink-3">Tap a lane for badges &amp; stats</p>
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
  champion,
  onSelect,
}: {
  row: Standing;
  top: number;
  isMe: boolean;
  index: number;
  titles: number;
  delta: number;
  champion?: boolean;
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

        <Avatar athlete={row.athlete} me={isMe} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`truncate text-[0.9375rem] font-semibold ${champion ? "text-gold" : "text-ink"}`}
            >
              {champion && (
                <Glyph name="crown" className="mr-1 inline h-3.5 w-3.5 -translate-y-px align-baseline" />
              )}
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
            {scored && row.grantedPoints > 0 && (
              <div
                style={{
                  width: `${(row.grantedPoints / row.points) * width * 100}%`,
                  backgroundImage: GRANT_HATCH,
                }}
                title={`Awarded: ${fmtPoints(row.grantedPoints)} pts`}
              />
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[0.6875rem] text-ink-3">
            {row.km > 0 && <span>{fmtKm(row.km)} km</span>}
            <span>
              {row.sessions} session{row.sessions === 1 ? "" : "s"}
            </span>
            {/* Auto-imported sessions are the ones nobody had to be trusted on.
                Only shown when there are some — silence isn't an accusation for
                athletes who simply never linked Strava. */}
            {row.stravaSessions > 0 && (
              <span className="text-ink-3">{row.stravaSessions} via Strava</span>
            )}
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

function SportLane({
  row,
  top,
  sport,
  isMe,
  index,
  champion,
  onSelect,
}: {
  row: SportRow;
  top: number;
  sport: Sport;
  isMe: boolean;
  index: number;
  champion?: boolean;
  onSelect: () => void;
}) {
  const ui = SPORT_UI[sport];
  const isFlat = SPORT_UNIT[sport] === "flat";
  const has = row.value > 0;
  const width = top > 0 ? Math.max(row.value / top, 0) : 0;

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
            className={`stamp text-2xl ${row.rank === 1 && has ? "text-gold" : "text-ink-3"}`}
          >
            {has ? row.rank : "—"}
          </span>
          <span className="eyebrow text-[0.5rem] text-ink-3">lane</span>
        </div>

        <Avatar athlete={row.athlete} me={isMe} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`truncate text-[0.9375rem] font-semibold ${champion ? "text-gold" : "text-ink"}`}
            >
              {champion && (
                <Glyph name="crown" className="mr-1 inline h-3.5 w-3.5 -translate-y-px align-baseline" />
              )}
              {row.athlete.name}
              {isMe && <span className="ml-1.5 text-xs font-normal text-ink-2">you</span>}
            </span>
            <span className="shrink-0 whitespace-nowrap">
              <span className={`stamp text-xl ${has ? ui.text : "text-ink-3"}`}>
                {isFlat ? row.value : fmtKm(row.value)}
              </span>
              <span className="eyebrow ml-1 text-ink-3">
                {isFlat ? (row.value === 1 ? "workout" : "workouts") : "km"}
              </span>
            </span>
          </div>

          <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-deck-2">
            {has && <div className={ui.bg} style={{ width: `${width * 100}%` }} />}
          </div>

          {!isFlat && (
            <div className="mt-1 font-mono text-[0.6875rem] text-ink-3">
              {row.sessions} session{row.sessions === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
