"use client";

import { useEffect, useMemo, useState } from "react";
import type { Activity } from "@/lib/types";
import {
  SPORT_ORDER,
  activityPoints,
  fmtKm,
  fmtPoints,
  standingsFor,
  standingsForRange,
  unscoredGymIds,
} from "@/lib/scoring";
import { SPORT_UI, GRANT_HATCH } from "@/lib/ui";
import { SPORT_UNIT, UNIT_LABEL, isGrant, type AppState } from "@/lib/types";
import {
  badgesFor,
  championshipsByAthlete,
  streakFor,
  type Badge,
  type BadgeTier,
} from "@/lib/achievements";
import { weeklyTrend } from "@/lib/stats";
import { firstSeason, seasonFor } from "@/lib/season";
import { formatDay, weekStart, type DayKey } from "@/lib/dates";
import { Glyph, type GlyphName } from "./Glyph";
import { SportMark } from "./SportMark";
import { Avatar } from "./Avatar";
import { TrendChart } from "./TrendChart";

export function AthleteSheet({
  state,
  athleteId,
  refDay,
  reigning,
  send,
  onClose,
}: {
  state: AppState;
  athleteId: string;
  refDay: DayKey;
  reigning?: string | null;
  send?: (url: string, init?: RequestInit) => Promise<string | null>;
  onClose: () => void;
}) {
  const [removing, setRemoving] = useState<string | null>(null);
  const athlete = state.athletes.find((a) => a.id === athleteId);
  const isChampion = !!athlete && reigning === athlete.id;

  const data = useMemo(() => {
    if (!athlete) return null;
    const { athletes, activities, settings } = state;
    const badges = badgesFor(athleteId, athletes, activities, settings, refDay);
    const streak = streakFor(athleteId, activities, settings, refDay, athlete?.name);
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

    const trend = weeklyTrend(athleteId, activities, settings, refDay, 8, athlete?.name);

    // Personal bests + lifetime totals from this athlete's own log — awarded
    // points aren't sessions, so they never set a personal best.
    const unscored = unscoredGymIds(activities);
    const mine = activities.filter((a) => a.athleteId === athleteId && !isGrant(a));
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
      // Newest first, for the admin list below. Ten is enough to reach a bad
      // import without turning the card into a second Log tab.
      recent: [...mine].sort((x, y) => (x.occurredOn < y.occurredOn ? 1 : -1)).slice(0, 10),
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
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-scrim" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${athlete.name} profile`}
        className="relative max-h-[88dvh] overflow-y-auto glass-raised rounded-t-3xl border-t border-line-2 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5"
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
            <h2 className={`stamp text-2xl ${isChampion ? "text-gold" : "text-ink"}`}>
              {isChampion && (
                <Glyph name="crown" className="mr-1.5 inline h-5 w-5 -translate-y-0.5 align-baseline" />
              )}
              {athlete.name}
            </h2>
            {isChampion && (
              <div className="eyebrow mt-1 inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[0.625rem] text-gold">
                Reigning champion
              </div>
            )}
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
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-xl pane border border-line bg-tile px-4 py-3 font-mono text-xs">
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
              {data.allTime!.grantedPoints > 0 && (
                <div
                  style={{
                    width: `${(data.allTime!.grantedPoints / data.allTime!.points) * 100}%`,
                    backgroundImage: GRANT_HATCH,
                  }}
                  title={`Awarded: ${fmtPoints(data.allTime!.grantedPoints)} pts`}
                />
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[0.625rem]">
              {SPORT_ORDER.filter((s) => (data.allTime?.bySport[s] ?? 0) > 0).map((s) => (
                <span key={s} className={SPORT_UI[s].text}>
                  {SPORT_UI[s].label} {fmtPoints(data.allTime!.bySport[s])}
                </span>
              ))}
              {data.allTime!.grantedPoints > 0 && (
                <span className="text-ink-2">Awarded {fmtPoints(data.allTime!.grantedPoints)}</span>
              )}
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

        {/* Trophy cabinet */}
        <div className="mt-5 flex items-baseline justify-between">
          <h3 className="eyebrow text-ink-2">Trophy cabinet</h3>
          <span className="font-mono text-xs text-ink-3">
            {earned.length}/{data.badges.length} unlocked
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          {data.badges.map((b) => (
            <BadgeTile key={b.id} badge={b} />
          ))}
        </div>

        {/* An admin's broom. Everyone else's sessions are theirs to edit in
            their own Log; this exists because Strava sometimes files something
            as a discipline it isn't, and only an admin can strike it off. */}
        {state.isAdmin && send && data.recent.length > 0 && (
          <AdminSessions
            state={state}
            sessions={data.recent}
            send={send}
            busyId={removing}
            setBusyId={setRemoving}
          />
        )}

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
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/90 p-6"
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

/**
 * The last ten sessions, with a delete — admin only.
 *
 * The Log tab only ever shows your own, so before this an admin could see a
 * wrong session on someone's card (a Strava import filed as the wrong
 * discipline, say) and have no way to remove it. The server already allowed
 * it; only the screen was missing.
 */
function AdminSessions({
  state,
  sessions,
  send,
  busyId,
  setBusyId,
}: {
  state: AppState;
  sessions: Activity[];
  send: (url: string, init?: RequestInit) => Promise<string | null>;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setBusyId(id);
    const err = await send(`/api/activities/${id}`, { method: "DELETE" });
    setBusyId(null);
    setConfirm(null);
    setError(err);
  }

  return (
    <div className="mt-5">
      <h3 className="eyebrow text-ink-2">Recent sessions · admin</h3>
      <ul className="mt-2 space-y-1">
        {sessions.map((a) => {
          const ui = SPORT_UI[a.sport];
          const pts = activityPoints(a, state.settings);
          return (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-line bg-tile px-3 py-2"
            >
              <SportMark sport={a.sport} className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.8125rem] text-ink">
                  {a.note?.trim() || ui.label}
                </div>
                <div className="font-mono text-[0.6875rem] text-ink-3">
                  {formatDay(a.occurredOn as DayKey)} · {fmtPoints(pts)} pts
                  {a.source === "strava" ? " · Strava" : ""}
                </div>
              </div>
              {confirm === a.id ? (
                <>
                  <button
                    onClick={() => remove(a.id)}
                    disabled={busyId === a.id}
                    className="eyebrow shrink-0 rounded-md bg-run px-2 py-1 text-white disabled:opacity-40"
                  >
                    {busyId === a.id ? "…" : "Delete"}
                  </button>
                  <button
                    onClick={() => setConfirm(null)}
                    className="eyebrow shrink-0 rounded-md border border-line px-2 py-1 text-ink-2"
                  >
                    Keep
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setError(null);
                    setConfirm(a.id);
                  }}
                  aria-label={`Delete ${a.note?.trim() || ui.label}`}
                  className="eyebrow shrink-0 rounded-md border border-line px-2 py-1 text-ink-2"
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-1.5 text-xs font-medium text-run">{error}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl pane border border-line bg-tile px-4 py-3">
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
    <div className="rounded-xl pane border border-line bg-tile px-3 py-3">
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
    <div className="flex items-center justify-between gap-2 rounded-xl pane border border-line bg-tile px-3.5 py-2.5">
      <span className="eyebrow text-ink-3">{label}</span>
      <span className="whitespace-nowrap">
        <span className={`stamp text-lg ${sport ? SPORT_UI[sport].text : "text-ink"}`}>{value}</span>
        <span className="ml-1 font-mono text-[0.625rem] text-ink-3">{unit}</span>
      </span>
    </div>
  );
}

// The four medal tiers, each with a colour, a soft tint, and a glow for the
// earned medallion. Bronze → Silver → Gold → Platinum.
const TIER: Record<BadgeTier, { label: string; color: string; bg: string; glow: string }> = {
  bronze: { label: "Bronze", color: "#C77B4A", bg: "rgba(199,123,74,0.13)", glow: "rgba(199,123,74,0.30)" },
  silver: { label: "Silver", color: "#8D97A8", bg: "rgba(141,151,168,0.16)", glow: "rgba(141,151,168,0.30)" },
  gold: { label: "Gold", color: "#E0A81E", bg: "rgba(224,168,30,0.15)", glow: "rgba(224,168,30,0.40)" },
  platinum: { label: "Platinum", color: "#3FB4CC", bg: "rgba(63,180,204,0.15)", glow: "rgba(63,180,204,0.45)" },
};

function BadgeTile({ badge }: { badge: Badge }) {
  const t = badge.tier ? TIER[badge.tier] : null;
  const earned = badge.earned;
  return (
    <div
      title={badge.what}
      className={`relative flex flex-col items-center rounded-2xl border px-3 py-3.5 text-center ${
        earned ? "" : "border-line bg-tile opacity-70"
      }`}
      style={earned && t ? { borderColor: t.color, background: t.bg } : undefined}
    >
      {badge.maxed && t && (
        <span
          className="absolute right-2 top-2 rounded-full px-1.5 py-px text-[0.5rem] font-bold tracking-wider"
          style={{ color: t.color, background: t.bg }}
        >
          MAX
        </span>
      )}

      <div
        className="flex h-12 w-12 items-center justify-center rounded-full border"
        style={
          earned && t
            ? { borderColor: t.color, background: t.bg, color: t.color, boxShadow: `0 0 16px ${t.glow}` }
            : { borderColor: "var(--color-line)", color: "var(--color-ink-3)" }
        }
      >
        <Glyph name={badge.glyph as GlyphName} className="h-6 w-6" />
      </div>

      <div className={`mt-2 text-sm font-semibold ${earned ? "text-ink" : "text-ink-3"}`}>
        {badge.name}
      </div>
      <div
        className="mt-0.5 text-[0.625rem] font-bold uppercase tracking-widest"
        style={{ color: earned && t ? t.color : "var(--color-ink-3)" }}
      >
        {earned && t ? t.label : "Locked"}
      </div>

      {/* Tier pips — one per level, filled up to the tier reached */}
      <div className="mt-1.5 flex gap-1">
        {Array.from({ length: badge.maxLevel }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: i < badge.level && t ? t.color : "var(--color-line)" }}
          />
        ))}
      </div>

      <div className="mt-1.5 font-mono text-[0.625rem] text-ink-3">{badge.detail}</div>
    </div>
  );
}
