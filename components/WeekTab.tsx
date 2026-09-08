"use client";

import { useMemo, useState } from "react";
import {
  SPORT_ORDER,
  activityPoints,
  fmtKm,
  fmtPoints,
  standingsFor,
  unscoredGymIds,
} from "@/lib/scoring";
import {
  RESET_HOUR, addDays, formatRange, periodRange, weekStart, type DayKey,
} from "@/lib/dates";
import { SPORT_UNIT, isGrant, isExcuse, type Activity } from "@/lib/types";
import { SPORT_UI, GRANT_HATCH } from "@/lib/ui";
import {
  headToHead,
  lastWeekRecap,
  movementByAthlete,
  streakFor,
} from "@/lib/achievements";
import { PaceClock } from "./PaceClock";
import { Glyph } from "./Glyph";
import { Avatar } from "./Avatar";
import { SportMark } from "./SportMark";
import { AthleteName, FlagName, FlagTag, useAwayIn, useReigningChampion } from "./ProfileContext";
import type { League } from "./useLeague";

export function WeekTab({
  league,
  refDay,
  logDay,
}: {
  league: League;
  /** The real calendar day — which week the tab opens on. */
  refDay: DayKey;
  /** The day a session logged right now counts for (see RESET_HOUR). */
  logDay: DayKey;
}) {
  const { state, send, busy } = league;
  // Athletes want to look at where they finished a past week — a leaderboard's
  // no fun if it evaporates on Monday. Nav is local to this tab; the rest of
  // the app keeps tracking "today" from AppShell's refDay.
  const currentWeekStart = weekStart(refDay);
  const [weekRef, setWeekRef] = useState<DayKey>(refDay);
  const viewedWeekStart = weekStart(weekRef);
  const isCurrentWeek = viewedWeekStart === currentWeekStart;
  const canGoForward = viewedWeekStart < currentWeekStart;
  const weekOffset = Math.round(
    (Date.parse(viewedWeekStart) - Date.parse(currentWeekStart)) / (7 * 86400_000),
  );
  const weekLabel =
    weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : `${-weekOffset} weeks ago`;
  // The board turns over at midnight but the scoring day doesn't until 3 AM, so
  // for those few hours the fresh week on screen and where a session would land
  // disagree. Say so plainly rather than letting it read as a lost log.
  const inWeekGrace = weekStart(logDay) !== weekStart(refDay);

  const standings = useMemo(
    () => standingsFor(state.athletes, state.activities, state.settings, "week", weekRef),
    [state.athletes, state.activities, state.settings, weekRef],
  );

  const meId = state.me?.id ?? "";
  const mine = standings.find((s) => s.athlete.id === meId);
  const goal = state.settings.weeklyGoal;
  const range = periodRange("week", weekRef);
  // Excused counts as through: they are not on the hook for the forfeit, and
  // leaving them in the denominator makes a week that everyone survived read as
  // "3/4 through" forever.
  const met = standings.filter((s) => s.points >= goal || s.excused).length;
  const champ = useReigningChampion();
  // Keyed to the week ON SCREEN, not to today — this tab pages back through
  // finished weeks, and an excuse belongs to the week it was granted for.
  const awayFlags = useAwayIn(weekRef);

  // Tap a name to decompose that person's points for the viewed week.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const unscored = useMemo(() => unscoredGymIds(state.activities), [state.activities]);
  const inViewedWeek = (a: Activity) =>
    a.occurredOn >= range[0] && a.occurredOn <= range[1];
  // Real logged sessions only — grants are pulled out and shown on their own.
  const weekSessions = (athleteId: string) =>
    state.activities
      .filter((a) => a.athleteId === athleteId && !isGrant(a) && inViewedWeek(a))
      .map((a) => ({ activity: a, points: activityPoints(a, state.settings, unscored) }))
      .sort((x, y) => y.points - x.points || x.activity.occurredOn.localeCompare(y.activity.occurredOn));
  const weekGrants = (athleteId: string) =>
    state.activities
      .filter((a) => a.athleteId === athleteId && isGrant(a) && inViewedWeek(a))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));

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

  // These lean on "right now" (streaks, since-yesterday movement, last-week
  // recap under the current week) so they only make sense on the current view.
  const passed = isCurrentWeek ? myMove?.passed ?? [] : [];
  const showStreak = isCurrentWeek && streak.current > 0;
  const showRecap = isCurrentWeek && recap;

  return (
    <div className="space-y-7">
      <section className="flex flex-col items-center">
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={() => setWeekRef(addDays(viewedWeekStart, -1))}
            aria-label="Previous week"
            className="flex h-9 w-9 items-center justify-center rounded-full pane border border-line bg-tile text-ink-2 active:bg-tile/70"
          >
            <Chevron dir="left" />
          </button>
          <div className="text-center">
            <p className="eyebrow text-ink-2">{weekLabel}</p>
            <p className="mt-1 font-mono text-xs text-ink-3">{formatRange(range)}</p>
          </div>
          <button
            type="button"
            onClick={() => setWeekRef(addDays(viewedWeekStart, 7))}
            aria-label="Next week"
            disabled={!canGoForward}
            className="flex h-9 w-9 items-center justify-center rounded-full pane border border-line bg-tile text-ink-2 active:bg-tile/70 disabled:opacity-30"
          >
            <Chevron dir="right" />
          </button>
        </div>

        {inWeekGrace && isCurrentWeek && (
          <p className="mt-3 w-full rounded-xl pane border border-line bg-tile px-4 py-2.5 text-center text-[0.8125rem] text-ink-2">
            New week&apos;s open. Anything logged before{" "}
            <span className="font-semibold text-ink">{RESET_HOUR} AM</span> still counts
            for last week.
          </p>
        )}

        {/* Week is the landing tab, so the board needs to be reachable without
            scrolling. The ring is the hero once there's a score to show, but a
            216px "0" pushed everyone else below the fold — it shrinks until
            there's something in it. */}
        <div className="mt-4">
          <PaceClock
            bySport={mine?.bySport}
            granted={mine?.grantedPoints}
            goal={goal}
            size={(mine?.points ?? 0) > 0 ? 196 : 148}
          />
        </div>

        {(mine?.grantedPoints ?? 0) > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-2">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-[3px] ring-1 ring-line"
              style={{ backgroundImage: GRANT_HATCH }}
            />
            {mine?.excused ? (
              <>Week excused — topped up to <span className="font-semibold text-ink">{fmtPoints(goal)}</span></>
            ) : (
              <>Includes <span className="font-semibold text-ink">{fmtPoints(mine!.grantedPoints)}</span> awarded by admin</>
            )}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {showStreak && (
            <span className="eyebrow inline-flex items-center gap-1.5 rounded-full bg-run/10 px-3 py-1.5 text-run">
              <Glyph name="flame" className="h-3.5 w-3.5" />
              {streak.current}-week streak
            </span>
          )}
          {mine && mine.rank >= 1 && mine.points > 0 && (
            <span className="eyebrow rounded-full bg-tile px-3 py-1.5 text-ink-2 ring-1 ring-line">
              {mine.rank === 1 ? (isCurrentWeek ? "Leading" : "Won the week") : `#${mine.rank} of ${standings.length}`}
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
              isCurrentWeek ? (
                <>
                  You&apos;re through the quota with{" "}
                  <span className="font-semibold text-ink">{fmtPoints(mine.points - goal)}</span> to spare.
                </>
              ) : (
                <>
                  Cleared quota by{" "}
                  <span className="font-semibold text-ink">{fmtPoints(mine.points - goal)} pts</span>.
                </>
              )
            ) : isCurrentWeek ? (
              <>
                Quota is <span className="font-semibold text-ink">{fmtPoints(goal)} pts</span> by Sunday night.
              </>
            ) : (
              <>
                {mine && mine.points > 0 ? (
                  <>
                    Finished{" "}
                    <span className="font-semibold text-ink">{fmtPoints(goal - mine.points)} pts</span> short of quota.
                  </>
                ) : (
                  <>No sessions logged this week.</>
                )}
              </>
            )}
          </p>
        )}
      </section>

      {h2h && (
        <section className="rounded-2xl pane border border-line-2 bg-tile p-4">
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
                <AthleteName id={h2h.rival.athlete.id} name={h2h.rival.athlete.name} />
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
            const done = row.points >= goal;
            const excused = row.excused;
            // Stack the bar: earned first, then the hatched granted tail.
            const granted = row.grantedPoints;
            const earned = Math.max(row.points - granted, 0);
            const earnedShown = goal > 0 ? Math.min(earned, goal) : 0;
            const grantedShown = goal > 0 ? Math.min(Math.max(granted, 0), goal - earnedShown) : 0;
            const earnedPct = goal > 0 ? (earnedShown / goal) * 100 : 0;
            const grantedPct = goal > 0 ? (grantedShown / goal) * 100 : 0;
            const isMe = row.athlete.id === meId;
            const isOpen = expanded.has(row.athlete.id);
            const gold = champ === row.athlete.id;
            const sessions = isOpen ? weekSessions(row.athlete.id) : [];
            const grants = isOpen ? weekGrants(row.athlete.id) : [];
            const flag = awayFlags.get(row.athlete.id);
            return (
              <li
                key={row.athlete.id}
                className={`overflow-hidden rounded-xl border bg-tile ${
                  isMe ? "border-ink" : "border-line"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(row.athlete.id)}
                  aria-expanded={isOpen}
                  className="relative flex w-full items-center gap-3 overflow-hidden px-3 py-2.5 text-left"
                >
                  {/* Same flag wash as the board lane — the two lists show the
                      same week and should say the same thing about it. Only the
                      collapsed header is painted: the expanded session list below
                      is dense text and reads badly over colour. */}
                  {flag && (
                    <>
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                          backgroundImage:
                            `linear-gradient(100deg, ${flag.from}80 0%, ${flag.from}5C 30%,` +
                            ` ${flag.mid}00 47%, ${flag.mid}00 53%,` +
                            ` ${flag.to}5C 70%, ${flag.to}80 100%)`,
                        }}
                      />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                          backgroundImage:
                            "linear-gradient(100deg, transparent 38%, rgba(255,255,255,0.45) 50%, transparent 62%)",
                          backgroundSize: "260% 100%",
                          animation: "flag-sheen 3.4s cubic-bezier(0.45, 0, 0.25, 1) infinite",
                        }}
                      />
                    </>
                  )}
                  <Avatar athlete={row.athlete} me={isMe} className="relative h-8 w-8 text-[0.625rem]" />
                  <div className="relative min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${gold ? "text-gold" : "text-ink"}`}
                      >
                        {gold && (
                          <Glyph
                            name="crown"
                            className="mr-1 inline h-3.5 w-3.5 -translate-y-px align-baseline"
                          />
                        )}
                        {/* Same flag as the board — this list draws names
                            directly too, and an away athlete should read the
                            same way everywhere. */}
                        {awayFlags.get(row.athlete.id) ? (
                          <>
                            <FlagName
                              name={row.athlete.name}
                              flag={awayFlags.get(row.athlete.id)!}
                            />
                            <FlagTag flag={awayFlags.get(row.athlete.id)!} />
                          </>
                        ) : (
                          row.athlete.name
                        )}
                      </span>
                      <span className="flex items-baseline gap-1.5 font-mono text-xs text-ink-2">
                        {granted > 0 && (
                          <span
                            className="rounded bg-ink-2/10 px-1 py-px text-[0.625rem] font-semibold text-ink-2"
                            title="Awarded by admin"
                          >
                            +{fmtPoints(granted)}
                          </span>
                        )}
                        <span>
                          <span className="text-ink">{fmtPoints(row.points)}</span>
                          <span className="text-ink-3">/{fmtPoints(goal)}</span>
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-deck-2">
                      <div
                        className={done ? "h-full bg-good" : "h-full accent-fill"}
                        style={{ width: `${earnedPct}%` }}
                      />
                      {grantedPct > 0 && (
                        <div
                          className="h-full"
                          style={{ width: `${grantedPct}%`, backgroundImage: GRANT_HATCH }}
                          title="Awarded by admin"
                        />
                      )}
                    </div>
                  </div>
                  {/* `done || excused`, not just `done`. The old excuse topped
                      the athlete up to the quota, so being excused implied
                      meeting it and this only ever needed to check the points. A
                      zero-cost excuse breaks that: the athlete is off the hook on
                      0 points, and checking `done` alone would render them as
                      plainly behind. */}
                  {(done || excused) && (
                    <span
                      className={`eyebrow relative shrink-0 rounded-md px-2 py-1 ${
                        excused ? "bg-ink-2/10 text-ink-2" : "bg-good/12 text-good"
                      }`}
                    >
                      {excused ? "Excused" : "Met"}
                    </span>
                  )}
                  <svg
                    viewBox="0 0 24 24"
                    className={`relative h-4 w-4 shrink-0 text-ink-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
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

                {isOpen && (
                  <div className="border-t-2 border-line px-3 py-2.5">
                    {(sessions.length > 0 || row.grantedPoints > 0) && (
                      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.6875rem]">
                        {SPORT_ORDER.filter((s) => (row.bySport[s] ?? 0) > 0).map((s) => (
                          <span key={s} className={SPORT_UI[s].text}>
                            {SPORT_UI[s].label} {fmtPoints(row.bySport[s])}
                          </span>
                        ))}
                        {row.grantedPoints > 0 && (
                          <span className="text-ink-2">
                            {row.excused ? "Excused" : "Awarded"} {fmtPoints(row.grantedPoints)}
                          </span>
                        )}
                      </div>
                    )}

                    {(sessions.length > 0 || grants.length > 0) ? (
                      <ul className="space-y-1.5">
                        {grants.map((g) => (
                          <GrantLine
                            key={g.id}
                            grant={g}
                            canManage={state.isAdmin}
                            busy={busy}
                            onDelete={() => send(`/api/activities/${g.id}`, { method: "DELETE" })}
                          />
                        ))}
                        {sessions.map(({ activity: a, points }) => {
                          const ui = SPORT_UI[a.sport];
                          const flat = SPORT_UNIT[a.sport] === "flat";
                          const isUnscored = unscored.has(a.id);
                          return (
                            <li key={a.id} className="flex items-center gap-2.5">
                              <span className={`shrink-0 ${ui.text}`} aria-hidden>
                                <SportMark sport={a.sport} className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">
                                {flat
                                  ? `${ui.label} workout`
                                  : `${fmtKm(a.km)} km ${ui.label.toLowerCase()}`}
                                {a.note && <span className="text-ink-3"> · {a.note}</span>}
                              </span>
                              <span
                                className={`shrink-0 font-mono text-xs ${
                                  isUnscored ? "text-ink-3 line-through" : "text-ink"
                                }`}
                              >
                                {fmtPoints(points)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="py-1 text-center text-[0.8125rem] text-ink-3">
                        No sessions this week.
                      </p>
                    )}

                    {state.isAdmin && (
                      <AdminGrant
                        athleteName={row.athlete.name}
                        shortfall={Math.max(goal - row.points, 0)}
                        goal={goal}
                        excused={excused}
                        busy={busy}
                        onExcuse={() =>
                          send("/api/grants", {
                            method: "POST",
                            body: JSON.stringify({
                              kind: "excuse",
                              athleteId: row.athlete.id,
                              occurredOn: range[0],
                            }),
                          })
                        }
                        onAward={(points) =>
                          send("/api/grants", {
                            method: "POST",
                            body: JSON.stringify({
                              athleteId: row.athlete.id,
                              occurredOn: range[0],
                              points,
                            }),
                          })
                        }
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {showRecap && recap && (
        <section className="rounded-2xl border border-gold/40 bg-gold/5 p-4">
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
              <div className="stamp text-xl text-ink">
                <AthleteName id={recap.champion.athlete.id} name={recap.champion.athlete.name} />
              </div>
            </div>
            <div className="text-right">
              <div className="stamp text-xl text-gold">{fmtPoints(recap.champion.points)}</div>
              <div className="eyebrow text-ink-3">pts</div>
            </div>
          </div>
          {(recap.missed.length > 0 || recap.excused.length > 0) && (
            <div className="mt-3 border-t border-gold/20 pt-2 text-xs text-ink-2">
              {recap.missed.length > 0 && (
                <>
                  <p>
                    <span className="font-semibold text-ink">Missed quota:</span>{" "}
                    {listNames(recap.missed.map((s) => s.athlete.name))}.
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-run">Forfeit:</span>{" "}
                    {state.settings.forfeit}
                  </p>
                </>
              )}
              {recap.excused.length > 0 && (
                <p className="mt-1">
                  <span className="font-semibold text-ink-2">Excused:</span>{" "}
                  {listNames(recap.excused.map((s) => s.athlete.name))}.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** One admin-awarded points row inside a week breakdown. */
function GrantLine({
  grant,
  canManage,
  busy,
  onDelete,
}: {
  grant: Activity;
  canManage: boolean;
  busy: boolean;
  onDelete: () => Promise<string | null>;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="h-4 w-4 shrink-0 rounded-[4px] ring-1 ring-line"
        style={{ backgroundImage: GRANT_HATCH }}
      />
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">
        {isExcuse(grant) ? "Excused this week" : "Awarded by admin"}
        {grant.note && <span className="text-ink-3"> · {grant.note}</span>}
      </span>
      {canManage && (
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label="Remove award"
          className="shrink-0 rounded-md px-1.5 py-0.5 text-ink-3 disabled:opacity-40"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
      <span className="shrink-0 font-mono text-xs text-ink">{fmtPoints(grant.points ?? 0)}</span>
    </li>
  );
}

/**
 * Admin-only controls for the viewed week: excuse the week (waive it — a top-up
 * to exactly the quota, shown as "excused") or award a discretionary amount.
 */
function AdminGrant({
  athleteName,
  shortfall,
  goal,
  excused,
  busy,
  onExcuse,
  onAward,
}: {
  athleteName: string;
  /** Points still needed to reach quota (0 once met) — the excuse top-up size. */
  shortfall: number;
  goal: number;
  /** Already waived for this week — hide the excuse button. */
  excused: boolean;
  busy: boolean;
  onExcuse: () => Promise<string | null>;
  onAward: (points: number) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function excuse() {
    setError(null);
    const err = await onExcuse();
    if (err) setError(err);
  }
  async function award(points: number) {
    setError(null);
    if (!Number.isFinite(points) || points <= 0) {
      setError("Enter a points amount.");
      return;
    }
    const err = await onAward(points);
    if (err) {
      setError(err);
      return;
    }
    setAmount("");
    setOpen(false);
  }

  return (
    <div className="mt-2.5 border-t border-line pt-2.5">
      {!open ? (
        <div className="flex flex-wrap items-center gap-2">
          {!excused && (
            <button
              type="button"
              disabled={busy}
              onClick={excuse}
              className="eyebrow rounded-lg pane border border-line-2 bg-tile px-3 py-1.5 text-ink disabled:opacity-40"
            >
              {shortfall > 0 ? `Excuse week (+${fmtPoints(shortfall)})` : "Excuse week"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="eyebrow rounded-lg px-2 py-1.5 text-ink-2"
          >
            Award points
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Points"
            className="w-24 rounded-lg pane border border-line-2 bg-tile px-2 py-1.5 text-sm text-ink focus:outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => award(Number(amount))}
            className="eyebrow rounded-lg border border-line-2 bg-accent/10 px-3 py-1.5 accent-text disabled:opacity-40"
          >
            Award
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setAmount("");
              setError(null);
            }}
            className="eyebrow px-2 py-1.5 text-ink-3"
          >
            Cancel
          </button>
        </div>
      )}
      <p className="mt-1 text-[0.6875rem] text-ink-3">
        {excused
          ? `${athleteName} is excused this week — topped up to ${fmtPoints(goal)}.`
          : `Excuse waives ${athleteName}'s week to ${fmtPoints(goal)}; award adds any amount. Counts toward the season.`}
      </p>
      {error && <p className="mt-1 text-xs font-medium text-run">{error}</p>}
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      {dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}

function listNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
