"use client";

import { useMemo } from "react";
import { SPORT_ORDER, fmtPoints, standingsFor } from "@/lib/scoring";
import { initials, SPORT_UI } from "@/lib/ui";
import { formatDay, formatRange, periodRange, type DayKey } from "@/lib/dates";
import { SPORT_UNIT, rateLabel, type AppState } from "@/lib/types";
import { daysUntilSeason } from "@/lib/season";
import {
  headToHead,
  lastWeekRecap,
  movementByAthlete,
  streakFor,
} from "@/lib/achievements";
import { PaceClock } from "./PaceClock";
import { Glyph } from "./Glyph";

export function WeekTab({
  state,
  refDay,
  preSeason = false,
}: {
  state: AppState;
  refDay: DayKey;
  preSeason?: boolean;
}) {
  if (preSeason) return <PreSeason state={state} refDay={refDay} />;
  return <LiveWeek state={state} refDay={refDay} />;
}

function LiveWeek({ state, refDay }: { state: AppState; refDay: DayKey }) {
  const standings = useMemo(
    () => standingsFor(state.athletes, state.activities, state.settings, "week", refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );

  const meId = state.me?.id ?? "";
  const mine = standings.find((s) => s.athlete.id === meId);
  const goal = state.settings.weeklyGoal;
  const range = periodRange("week", refDay);
  const met = standings.filter((s) => s.points >= goal).length;

  const streak = useMemo(
    () => streakFor(meId, state.activities, state.settings, refDay),
    [meId, state.activities, state.settings, refDay],
  );
  const h2h = useMemo(() => headToHead(standings, meId), [standings, meId]);
  const myMove = useMemo(
    () => movementByAthlete(state.athletes, state.activities, state.settings, refDay).get(meId),
    [state.athletes, state.activities, state.settings, refDay, meId],
  );
  const recap = useMemo(
    () => lastWeekRecap(state.athletes, state.activities, state.settings, refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );

  const passed = myMove?.passed ?? [];

  return (
    <div className="space-y-7">
      <section className="flex flex-col items-center">
        <p className="eyebrow text-ink-2">This week</p>
        <p className="mt-1 font-mono text-xs text-ink-3">{formatRange(range)}</p>
        <div className="mt-5">
          <PaceClock points={mine?.points ?? 0} goal={goal} size={216} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {streak.current > 0 && (
            <span className="eyebrow inline-flex items-center gap-1.5 rounded-full bg-run/10 px-3 py-1.5 text-run">
              <Glyph name="flame" className="h-3.5 w-3.5" />
              {streak.current}-week streak
            </span>
          )}
          {mine && mine.rank >= 1 && mine.points > 0 && (
            <span className="eyebrow rounded-full bg-tile px-3 py-1.5 text-ink-2 ring-1 ring-line">
              {mine.rank === 1 ? "Leading" : `#${mine.rank} of ${standings.length}`}
            </span>
          )}
        </div>

        {passed.length > 0 && (
          <p className="mt-3 text-center text-sm font-medium text-good">
            ↑ You overtook {listNames(passed)} since yesterday
          </p>
        )}
        {passed.length === 0 && (
          <p className="mt-3 text-center text-sm text-ink-2">
            {mine && mine.points >= goal ? (
              <>
                You&apos;re through the quota with{" "}
                <span className="font-semibold text-ink">{fmtPoints(mine.points - goal)}</span> to spare.
              </>
            ) : (
              <>
                Quota is <span className="font-semibold text-ink">{fmtPoints(goal)} pts</span> by Sunday night.
              </>
            )}
          </p>
        )}
      </section>

      {h2h && (
        <section className="rounded-2xl border-2 border-ink bg-tile p-4">
          <p className="eyebrow text-ink-2">
            {h2h.leading ? "Chasing you" : "Right ahead of you"}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">You</div>
              <div className="stamp text-2xl accent-text">{fmtPoints(h2h.me.points)}</div>
            </div>
            <div className="text-center">
              <div
                className={`stamp text-lg ${h2h.leading ? "text-good" : "text-run"}`}
              >
                {h2h.leading ? "+" : "−"}
                {fmtPoints(Math.abs(h2h.diff))}
              </div>
              <div className="eyebrow text-ink-3">{h2h.leading ? "ahead" : "behind"}</div>
            </div>
            <div className="min-w-0 flex-1 text-right">
              <div className="truncate text-sm font-semibold text-ink">
                {h2h.rival.athlete.name}
              </div>
              <div className="stamp text-2xl text-ink-2">{fmtPoints(h2h.rival.points)}</div>
            </div>
          </div>
          {!h2h.leading && h2h.diff < 0 && (
            <p className="mt-2 text-center text-xs text-ink-2">
              {fmtPoints(Math.abs(h2h.diff))} pts to take the spot.
            </p>
          )}
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow text-ink-2">Everyone</h2>
          <span className="font-mono text-xs text-ink-3">
            {met}/{standings.length} through
          </span>
        </div>

        <ul className="mt-3 space-y-2">
          {standings.map((row) => {
            const pct = Math.min(row.goalProgress, 1) * 100;
            const done = row.points >= goal;
            const isMe = row.athlete.id === meId;
            return (
              <li
                key={row.athlete.id}
                className={`rounded-xl border-2 bg-tile px-3 py-2.5 ${
                  isMe ? "border-ink" : "border-line"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[0.625rem] font-bold ${
                      isMe ? "border-ink bg-ink text-tile" : "border-line text-ink-2"
                    }`}
                  >
                    {initials(row.athlete.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {row.athlete.name}
                      </span>
                      <span className="font-mono text-xs text-ink-2">
                        <span className="text-ink">{fmtPoints(row.points)}</span>
                        <span className="text-ink-3">/{fmtPoints(goal)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-deck-2">
                      <div
                        className={done ? "h-full bg-good" : "h-full accent-fill"}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  {done && (
                    <span className="eyebrow shrink-0 rounded-md bg-good/12 px-2 py-1 text-good">
                      Met
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {recap && (
        <section className="rounded-2xl border-2 border-gold/40 bg-gold/5 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow text-gold">Last week</h2>
            <span className="font-mono text-xs text-ink-3">{recap.rangeLabel}</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-gold" aria-hidden>
              <Glyph name="trophy" className="h-7 w-7" />
            </span>
            <div className="flex-1">
              <div className="text-sm text-ink-2">Champion</div>
              <div className="stamp text-xl text-ink">{recap.champion.athlete.name}</div>
            </div>
            <div className="text-right">
              <div className="stamp text-xl text-gold">{fmtPoints(recap.champion.points)}</div>
              <div className="eyebrow text-ink-3">pts</div>
            </div>
          </div>
          {recap.missed.length > 0 && (
            <div className="mt-3 border-t border-gold/20 pt-2 text-xs text-ink-2">
              <p>
                <span className="font-semibold text-ink">Missed quota:</span>{" "}
                {listNames(recap.missed.map((s) => s.athlete.name))}.
              </p>
              <p className="mt-1">
                <span className="font-semibold text-run">Forfeit:</span>{" "}
                {state.settings.forfeit}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function listNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function PreSeason({ state, refDay }: { state: AppState; refDay: DayKey }) {
  const days = daysUntilSeason(state.settings, refDay);
  const s = state.settings;

  return (
    <div className="space-y-6">
      <section className="flex flex-col items-center rounded-2xl border-2 border-ink bg-tile px-5 py-8 text-center">
        <p className="eyebrow text-ink-2">The season opens</p>
        <h2 className="stamp mt-2 text-3xl text-ink">{formatDay(s.seasonStart)}</h2>
        <div className="mt-5">
          <span className="stamp accent-text text-[4rem] leading-none">{days}</span>
        </div>
        <p className="eyebrow mt-1 text-ink-3">
          {days === 1 ? "day to kickoff" : "days to kickoff"}
        </p>
        <p className="mt-4 max-w-xs text-sm text-ink-2">
          Log all you want to warm up — nothing counts on the board until the gun
          goes off.
        </p>
      </section>

      <section className="rounded-2xl border-2 border-line bg-deck-2/40 p-4">
        <h3 className="eyebrow text-ink-2">The rules</h3>
        <p className="mt-2 font-mono text-sm text-ink">
          Hit <span className="accent-text font-bold">{fmtPoints(s.weeklyGoal)} pts</span> every week.
        </p>
        <p className="mt-2 font-mono text-xs text-ink-3">
          {SPORT_ORDER.map(
            (sp) => `${SPORT_UI[sp].label.toLowerCase()} ${rateLabel(s.multipliers[sp], SPORT_UNIT[sp])}`,
          ).join("  ·  ")}
        </p>
      </section>

      <section className="rounded-2xl border-2 border-run/40 bg-run/5 p-4">
        <div className="flex items-center gap-2">
          <span className="text-run">
            <Glyph name="flame" className="h-4 w-4" />
          </span>
          <h3 className="eyebrow text-run">Miss quota, and…</h3>
        </div>
        <p className="mt-2 text-[0.9375rem] font-semibold text-ink">{s.forfeit}</p>
      </section>
    </div>
  );
}
