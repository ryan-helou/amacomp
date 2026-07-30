"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SPORT_ORDER,
  activityPoints,
  fmtKm,
  fmtPoints,
  standingsFor,
  standingsForRange,
  unscoredGymIds,
} from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { SPORT_UNIT, UNIT_LABEL, type AppState } from "@/lib/types";
import {
  badgesFor,
  championshipsByAthlete,
  streakFor,
} from "@/lib/achievements";
import { weeklyTrend } from "@/lib/stats";
import { firstSeason, seasonFor } from "@/lib/season";
import { formatDay, weekStart, type DayKey } from "@/lib/dates";
import { Glyph, type GlyphName } from "./Glyph";
import { Avatar } from "./Avatar";
import { TrendChart } from "./TrendChart";

export function AthleteSheet({
  state,
  athleteId,
  refDay,
  onClose,
}: {
  state: AppState;
  athleteId: string;
  refDay: DayKey;
  onClose: () => void;
}) {
  const athlete = state.athletes.find((a) => a.id === athleteId);

  const data = useMemo(() => {
    if (!athlete) return null;
    const { athletes, activities, settings } = state;
    const badges = badgesFor(athleteId, activities, settings, refDay);
    const streak = streakFor(athleteId, activities, settings, refDay);
    const titles =
      championshipsByAthlete(athletes, activities, settings, refDay).get(athleteId) ?? 0;

    const rowIn = (period: "week" | "month" | "all") =>
      standingsFor(athletes, activities, settings, period, refDay).find(
        (s) => s.athlete.id === athleteId,
      );
    const week = rowIn("week");
    const month = rowIn("month");
    const allTime = rowIn("all");

    const season = seasonFor(refDay, settings.seasonStart) ?? firstSeason(settings.seasonStart);
    const seasonRow = standingsForRange(athletes, activities, settings, [
      season.start,
      season.end,
    ]).find((s) => s.athlete.id === athleteId);

    const trend = weeklyTrend(athleteId, activities, settings, refDay, 8);

    // Personal bests + lifetime totals from this athlete's own log.
    const unscored = unscoredGymIds(activities);
    const mine = activities.filter((a) => a.athleteId === athleteId);
    let longestRun = 0,
      longestRide = 0,
      longestSwim = 0,
      biggestSession = 0;
    const dayPts = new Map<string, number>();
    const weekPts = new Map<string, number>();
    const daySet = new Set<string>();
    let firstDay: string | null = null;
    for (const a of mine) {
      const p = activityPoints(a, settings, unscored);
      if (a.sport === "run") longestRun = Math.max(longestRun, a.km);
      else if (a.sport === "bike") longestRide = Math.max(longestRide, a.km);
      else if (a.sport === "swim") longestSwim = Math.max(longestSwim, a.km);
      if (p > biggestSession) biggestSession = p;
      dayPts.set(a.occurredOn, (dayPts.get(a.occurredOn) ?? 0) + p);
      const wk = weekStart(a.occurredOn as DayKey);
      weekPts.set(wk, (weekPts.get(wk) ?? 0) + p);
      daySet.add(a.occurredOn);
      if (!firstDay || a.occurredOn < firstDay) firstDay = a.occurredOn;
    }
    const biggestDay = dayPts.size ? Math.max(...dayPts.values()) : 0;
    const biggestWeek = weekPts.size ? Math.max(...weekPts.values()) : 0;

    return {
      badges,
      streak,
      titles,
      week,
      month,
      allTime,
      season,
      seasonRow,
      trend,
      longestRun,
      longestRide,
      longestSwim,
      biggestSession,
      biggestDay,
      biggestWeek,
      activeDays: daySet.size,
      firstDay,
    };
  }, [athlete, athleteId, state, refDay]);

  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (zoom ? setZoom(false) : onClose());
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, zoom]);

  if (!athlete || !data) return null;
  const isMe = athlete.id === state.me?.id;
  const hasPhoto = !!athlete.avatarUrl;
  const earned = data.badges.filter((b) => b.earned);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${athlete.name} profile`}
        className="relative max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t-2 border-ink bg-deck px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-3" />

        <div className="flex items-center gap-3">
          {hasPhoto ? (
            <button
              type="button"
              onClick={() => setZoom(true)}
              aria-label={`View ${athlete.name}'s photo`}
              className="shrink-0 rounded-full transition-transform active:scale-95"
            >
              <Avatar athlete={athlete} me={isMe} className="h-14 w-14 text-base" />
            </button>
          ) : (
            <Avatar athlete={athlete} me={isMe} className="h-14 w-14 text-base" />
          )}
          <div className="flex-1">
            <h2 className="stamp text-2xl text-ink">{athlete.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-ink-2">
              {data.titles > 0 && (
                <span className="inline-flex items-center gap-1 text-gold">
                  <Glyph name="trophy" className="h-3.5 w-3.5" />
                  {data.titles} title{data.titles === 1 ? "" : "s"}
                </span>
              )}
              <span>{data.streak.current}-wk streak</span>
              <span className="text-ink-3">best {data.streak.best}</span>
            </div>
          </div>
          <button onClick={onClose} className="eyebrow text-ink-2">
            Close
          </button>
        </div>

        {/* Where they rank, across every timeframe */}
        <div className="mt-5">
          <h3 className="eyebrow text-ink-2">Standings</h3>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <RankTile label="This week" rank={data.week?.rank} points={data.week?.points ?? 0} />
            <RankTile
              label={data.season.monthsLabel}
              rank={data.seasonRow?.rank}
              points={data.seasonRow?.points ?? 0}
            />
            <RankTile
              label="All-time"
              rank={data.allTime?.rank}
              points={data.allTime?.points ?? 0}
            />
          </div>
        </div>

        {/* Lifetime totals */}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Stat label="Sessions" value={String(data.allTime?.sessions ?? 0)} />
          <Stat label="Total km" value={fmtKm(data.allTime?.km ?? 0)} />
          <Stat label="Active days" value={String(data.activeDays)} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-xl border-2 border-line bg-tile px-4 py-3 font-mono text-xs">
          {SPORT_ORDER.map((s) => {
            const amount = data.allTime?.kmBySport[s] ?? 0;
            if (amount <= 0) return null;
            return (
              <span key={s} className={SPORT_UI[s].text}>
                {SPORT_UI[s].label} {fmtKm(amount)} {UNIT_LABEL[SPORT_UNIT[s]]}
              </span>
            );
          })}
          {(data.allTime?.sessions ?? 0) === 0 && (
            <span className="text-ink-3">No sessions yet.</span>
          )}
        </div>

        {/* Discipline mix */}
        {(data.allTime?.points ?? 0) > 0 && (
          <div className="mt-4">
            <h3 className="eyebrow text-ink-2">Discipline mix</h3>
            <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-deck-2">
              {SPORT_ORDER.map((s) => {
                const share = (data.allTime!.bySport[s] ?? 0) / data.allTime!.points;
                if (share <= 0) return null;
                return (
                  <div
                    key={s}
                    className={SPORT_UI[s].bg}
                    style={{ width: `${share * 100}%` }}
                    title={`${SPORT_UI[s].label}: ${fmtPoints(data.allTime!.bySport[s])} pts`}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[0.625rem]">
              {SPORT_ORDER.filter((s) => (data.allTime?.bySport[s] ?? 0) > 0).map((s) => (
                <span key={s} className={SPORT_UI[s].text}>
                  {SPORT_UI[s].label} {fmtPoints(data.allTime!.bySport[s])}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Personal bests */}
        {(data.allTime?.sessions ?? 0) > 0 && (
          <div className="mt-5">
            <h3 className="eyebrow text-ink-2">Personal bests</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <PB label="Best week" value={fmtPoints(data.biggestWeek)} unit="pts" />
              <PB label="Best day" value={fmtPoints(data.biggestDay)} unit="pts" />
              <PB label="Biggest session" value={fmtPoints(data.biggestSession)} unit="pts" />
              <PB label="Longest streak" value={String(data.streak.best)} unit="wks" />
              {data.longestRun > 0 && (
                <PB label="Longest run" value={fmtKm(data.longestRun)} unit="km" sport="run" />
              )}
              {data.longestRide > 0 && (
                <PB label="Longest ride" value={fmtKm(data.longestRide)} unit="km" sport="bike" />
              )}
              {data.longestSwim > 0 && (
                <PB label="Longest swim" value={fmtKm(data.longestSwim)} unit="km" sport="swim" />
              )}
            </div>
          </div>
        )}

        {/* Weekly form */}
        <div className="mt-5">
          <h3 className="eyebrow text-ink-2">Last 8 weeks</h3>
          <div className="mt-2">
            <TrendChart weeks={data.trend} goal={state.settings.weeklyGoal} />
          </div>
        </div>

        {/* Badges */}
        <div className="mt-5 flex items-baseline justify-between">
          <h3 className="eyebrow text-ink-2">Badges</h3>
          <span className="font-mono text-xs text-ink-3">
            {earned.length}/{data.badges.length}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {data.badges.map((b) => (
            <div
              key={b.id}
              className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 ${
                b.earned ? "border-ink bg-tile" : "border-line bg-transparent opacity-55"
              }`}
            >
              <span className={b.earned ? "text-accent" : "text-ink-3"}>
                <Glyph name={b.glyph as GlyphName} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink">{b.name}</div>
                <div className="truncate text-[0.6875rem] text-ink-2">{b.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {data.firstDay && (
          <p className="mt-4 text-center font-mono text-[0.6875rem] text-ink-3">
            Logging since {formatDay(data.firstDay as DayKey)}
          </p>
        )}
      </div>

      {zoom && athlete.avatarUrl && (
        <button
          type="button"
          aria-label="Close photo"
          onClick={() => setZoom(false)}
          className="absolute inset-0 z-10 flex items-center justify-center bg-ink/90 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- full-size profile photo viewer */}
          <img
            src={athlete.avatarUrl}
            alt={athlete.name}
            className="max-h-[82vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-line bg-tile px-4 py-3">
      <div className="stamp text-2xl text-ink">{value}</div>
      <div className="eyebrow mt-0.5 text-ink-3">{label}</div>
    </div>
  );
}

function RankTile({
  label,
  rank,
  points,
}: {
  label: string;
  rank?: number;
  points: number;
}) {
  const ranked = points > 0 && rank != null;
  return (
    <div className="rounded-xl border-2 border-line bg-tile px-3 py-3">
      <div className={`stamp text-2xl ${ranked ? "text-ink" : "text-ink-3"}`}>
        {ranked ? `#${rank}` : "—"}
      </div>
      <div className="mt-0.5 font-mono text-[0.625rem] text-ink-2">
        {ranked ? `${fmtPoints(points)} pts` : "no pts"}
      </div>
      <div className="eyebrow mt-1 text-ink-3">{label}</div>
    </div>
  );
}

function PB({
  label,
  value,
  unit,
  sport,
}: {
  label: string;
  value: string;
  unit: string;
  sport?: "run" | "bike" | "swim";
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-line bg-tile px-3.5 py-2.5">
      <span className="eyebrow text-ink-3">{label}</span>
      <span className="whitespace-nowrap">
        <span className={`stamp text-lg ${sport ? SPORT_UI[sport].text : "text-ink"}`}>{value}</span>
        <span className="ml-1 font-mono text-[0.625rem] text-ink-3">{unit}</span>
      </span>
    </div>
  );
}
