"use client";

import { useEffect, useMemo, useState } from "react";
import { SPORT_ORDER, fmtKm, fmtPoints, standingsFor } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { SPORT_UNIT, UNIT_LABEL, type AppState } from "@/lib/types";
import {
  badgesFor,
  championshipsByAthlete,
  streakFor,
} from "@/lib/achievements";
import { weeklyTrend } from "@/lib/stats";
import type { DayKey } from "@/lib/dates";
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
    const badges = badgesFor(athleteId, state.activities, state.settings, refDay);
    const streak = streakFor(athleteId, state.activities, state.settings, refDay);
    const titles =
      championshipsByAthlete(state.athletes, state.activities, state.settings, refDay).get(
        athleteId,
      ) ?? 0;
    const allTime = standingsFor(
      state.athletes,
      state.activities,
      state.settings,
      "all",
      refDay,
    ).find((s) => s.athlete.id === athleteId);
    const trend = weeklyTrend(athleteId, state.activities, state.settings, refDay, 8);
    return { badges, streak, titles, allTime, trend };
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

        {/* All-time totals by discipline */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Stat label="All-time points" value={fmtPoints(data.allTime?.points ?? 0)} />
          <Stat label="Sessions" value={String(data.allTime?.sessions ?? 0)} />
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
