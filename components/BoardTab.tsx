"use client";

import { useMemo, useState } from "react";
import {
  SPORT_ORDER,
  fmtKm,
  fmtPoints,
  ratesOn,
  standingsForRange,
  type Standing,
} from "@/lib/scoring";
import { SPORT_UI, GRANT_HATCH } from "@/lib/ui";
import { addDays, formatRange, monthEnd, monthStart, periodRange, type DayKey, type Period } from "@/lib/dates";
import { SPORT_UNIT, elevationRateLabel, rateLabel, isGrant, type Athlete, type AppState, type Sport } from "@/lib/types";
import { championshipsByAthlete, movementByAthlete } from "@/lib/achievements";
import { flagInk, flagWash, type Flag } from "@/lib/away";
import { firstSeason, seasonFor } from "@/lib/season";
import { FlagName, FlagTag, useAwayIn, useOpenProfile, useReigningChampion } from "./ProfileContext";
import { Glyph } from "./Glyph";
import { Avatar } from "./Avatar";
import { Figure, useFigures, useLane } from "./AthleteFigure";
import { SportMark } from "./SportMark";
import { CLIMB_SPORTS, climbLeader, climbStandings, fmtMetres, type ClimbRow } from "@/lib/climb";

// "climb" is not a discipline — it is the same sessions ranked by the metres
// that go up instead of the kilometres that go along. It rides in the same
// control because that is where someone looks to change what the board shows.
type SportFilter = Sport | "all" | "climb";
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

  // Browsing back in time. Ryan, 2026-11-15: arrows to go back through days,
  // weeks, months and seasons, and forward again to the present; on All they
  // stay, shaded. Null is "the present" rather than a stored copy of today, so
  // the board still turns over at midnight while nobody is browsing.
  const [browse, setBrowse] = useState<DayKey | null>(null);
  const cursor = browse ?? refDay;

  const liveSeason = seasonFor(refDay, state.settings.seasonStart);
  const season =
    seasonFor(cursor, state.settings.seasonStart) ?? firstSeason(state.settings.seasonStart);

  // One date window drives everything, so the Season tab reuses the same
  // range-based standings as the calendar periods.
  const range = useMemo<[DayKey, DayKey]>(
    () => (period === "season" ? [season.start, season.end] : periodRange(period, cursor)),
    [period, cursor, season.start, season.end],
  );
  const atPresent = period === "all" || range[1] >= refDay;

  // Nothing to browse to before the first session anybody logged.
  const earliest = useMemo(
    () => state.activities.reduce<DayKey | null>((m, a) => (m === null || a.occurredOn < m ? a.occurredOn : m), null),
    [state.activities],
  );
  function stepped(dir: -1 | 1): DayKey {
    if (period === "today") return addDays(cursor, dir);
    if (period === "week") return addDays(cursor, 7 * dir);
    if (period === "month") return dir < 0 ? addDays(monthStart(cursor), -1) : addDays(monthEnd(cursor), 1);
    return dir < 0 ? addDays(season.start, -1) : addDays(season.end, 1);
  }
  const prevDay = stepped(-1);
  const canBack =
    period !== "all" &&
    earliest !== null &&
    (period === "season"
      ? seasonFor(prevDay, state.settings.seasonStart) !== null && prevDay >= earliest
      : prevDay >= earliest);
  const canForward = period !== "all" && !atPresent;
  function go(dir: -1 | 1) {
    const next = stepped(dir);
    // Landing on (or past) the window that holds today is the present again.
    const nextRange: [DayKey, DayKey] =
      period === "season"
        ? (() => {
            const sn = seasonFor(next, state.settings.seasonStart);
            return sn ? [sn.start, sn.end] : [next, next];
          })()
        : periodRange(period as Period, next);
    setBrowse(nextRange[1] >= refDay ? null : next);
  }

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

  // Only the Week tab flies it. An excuse is a week-shaped thing: it says
  // nothing about today, and on Month/Season/All the flagged athlete is being
  // ranked over spans the excuse doesn't cover.
  const awayWeek = useAwayIn(cursor);
  const away = period === "week" ? awayWeek : null;

  const climbRows = useMemo<ClimbRow[] | null>(
    () => (sport === "climb" ? climbStandings(state.athletes, state.activities, range) : null),
    [sport, state.athletes, state.activities, range],
  );

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
  const climbTop = climbRows?.[0]?.total ?? 0;
  const anyClimb = (climbRows ?? []).some((r) => r.total > 0);

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
          className="flex gap-1 rounded-xl pane border border-line bg-tile p-1"
        >
          {PERIOD_TABS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              onClick={() => {
                setPeriod(p.id);
                setBrowse(null);
              }}
              className={`eyebrow flex-1 rounded-lg py-2.5 transition-colors ${
                period === p.id ? "bg-ink text-on-ink" : "text-ink-2"
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
            className={`flex h-9 flex-1 items-center justify-center rounded-lg border transition-colors ${
              sport === "all" ? "border-ink bg-ink text-on-ink" : "border-line bg-tile text-ink-3"
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
                className={`flex h-9 flex-1 items-center justify-center rounded-lg border transition-colors ${
                  on ? `${ui.border} ${ui.bg} text-white` : `border-line bg-tile ${ui.text}`
                }`}
              >
                <SportMark sport={s} className="h-[18px] w-[18px]" />
              </button>
            );
          })}
          <button
            role="tab"
            aria-selected={sport === "climb"}
            aria-label="Climbing"
            onClick={() => setSport("climb")}
            className={`flex h-9 flex-1 items-center justify-center rounded-lg border transition-colors ${
              sport === "climb"
                ? "border-gold bg-gold text-white"
                : "border-line bg-tile text-gold"
            }`}
          >
            <Glyph name="mountain" className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={!canBack}
          aria-label="Back in time"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full pane border border-line bg-tile text-ink-2 active:bg-tile/70 disabled:opacity-30"
        >
          <BoardChevron dir="left" />
        </button>
        <p className="min-w-0 text-center font-mono text-xs text-ink-3">
          {sport === "climb" ? (
            <span className="text-gold">King of the Mountains · </span>
          ) : (
            sport !== "all" && (
              <span className={SPORT_UI[sport].text}>
                {SPORT_UI[sport].label} ·{" "}
              </span>
            )
          )}
          {period === "all" ? "Every session ever logged" : formatRange(range)}
        </p>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={!canForward}
          aria-label="Forward in time"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full pane border border-line bg-tile text-ink-2 active:bg-tile/70 disabled:opacity-30"
        >
          <BoardChevron dir="right" />
        </button>
        </div>
      </div>

      {/* Every lane list below is keyed by period and discipline, so switching
          board builds fresh rows rather than rewriting the numbers inside the
          old ones. On Ryan's iPhone a Month -> Season switch left the top two
          lanes painted with September's totals while the third had updated —
          the rows that kept the same athlete (and so the same avatar) never
          repainted, only their text had changed. New rows cannot keep a stale
          paint. The lanes re-run their entrance too, which reads as the board
          changing on purpose. */}
      {/* The run-in panel used to sit here, above the season's lanes. Ryan
          removed it on 2026-10-06; lib/race.ts still holds the maths. */}

      {sport === "climb" ? (
        !anyClimb ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-2">
            Nobody has climbed anything in this window. Bike and run ascent counts —
            the flat stuff doesn&rsquo;t.
          </p>
        ) : (
          <>
            <ol key={`${period}-${sport}`} className="space-y-0">
              {(climbRows ?? []).map((row, i) => (
                <li key={row.athlete.id}>
                  {i > 0 && <div className="lane-rope my-1" />}
                  <ClimbLane
                    row={row}
                    top={climbTop}
                    isMe={row.athlete.id === state.me?.id}
                    index={i}
                    champion={reigning === row.athlete.id}
                    onSelect={() => openProfile(row.athlete.id)}
                  />
                </li>
              ))}
            </ol>
            <ClimbSubTitles rows={climbRows ?? []} />
          </>
        )
      ) : sport === "all" ? (
        !anyPoints ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-2">
            No points in this window yet. The lanes fill as sessions come in.
          </p>
        ) : (
          <ol key={`${period}-${sport}`} className="space-y-0">
            {standings.map((row, i) => (
              <li key={row.athlete.id}>
                {i > 0 && <div className="lane-rope my-1" />}
                <Lane
                  row={row}
                  top={top}
                  isMe={row.athlete.id === state.me?.id}
                  index={i}
                  titles={titles.get(row.athlete.id) ?? 0}
                  delta={period === "week" && atPresent ? movement.get(row.athlete.id)?.delta ?? 0 : 0}
                  awayFlag={away?.get(row.athlete.id)}
                  champion={reigning === row.athlete.id}
                  onSelect={() => openProfile(row.athlete.id)}
                />
              </li>
            ))}
          </ol>
        )
      ) : !anySport ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-2">
          No {SPORT_UI[sport].label.toLowerCase()} logged in this window yet.
        </p>
      ) : (
        <ol key={`${period}-${sport}`} className="space-y-0">
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
          const rates = ratesOn(refDay, state.settings);
          const climb = elevationRateLabel(rates.elevationPer100m?.[s] ?? 0);
          return `${SPORT_UI[s].label.toLowerCase()} ${rateLabel(rates.multipliers[s], SPORT_UNIT[s])}${climb ? ` +${climb}` : ""}`;
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
  awayFlag,
  champion,
  onSelect,
}: {
  row: Standing;
  top: number;
  isMe: boolean;
  index: number;
  titles: number;
  delta: number;
  /** Set only when this board is showing the week the athlete is away for. */
  awayFlag?: Flag;
  champion?: boolean;
  onSelect: () => void;
}) {
  const width = top > 0 ? Math.max(row.points / top, 0) : 0;
  const scored = row.points > 0;
  // The country he bought flies behind the row. An AWAY flag beats it: that
  // one is news — he is abroad this week — and the bought one is decoration,
  // so they must never be painted over each other.
  const figures = useFigures();
  const lane = useLane(row.athlete);
  const flying = awayFlag ? undefined : lane;

  return (
    <button
      onClick={onSelect}
      className={`lane-enter relative block w-full overflow-hidden rounded-xl px-3 py-1 text-left transition-colors ${
        isMe ? "bg-tile ring-2 ring-ink" : "hover:bg-tile/60"
      }`}
      style={{
        animationDelay: `${Math.min(index, 8) * 45}ms`,
        ...flying,
        ...(awayFlag ? { boxShadow: `inset 0 0 0 1px ${awayFlag.from}99`, ...flagInk(awayFlag) } : null),
      }}
    >
      {/* An away athlete's whole lane flies the flag: three soft bands at a low
          alpha so the ink on top stays the darkest thing in the row, with a
          highlight drifting across so it reads as fabric rather than a fill.
          Feathered rather than hard-edged — a crisp tricolour behind a
          leaderboard row looks like a rendering fault; a soft one looks lit. */}
      {awayFlag && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              ...flagWash(awayFlag),
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
      <div className="relative flex items-center gap-3">
        <div
          className={`flex shrink-0 flex-col items-center ${flying ? "flag-plate -mx-1 w-10 py-1" : "w-8"}`}
        >
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

        {figures ? (
          <Figure athlete={row.athlete} flag={null} className="w-11" />
        ) : (
          <Avatar athlete={row.athlete} me={isMe} />
        )}

        <div className={`min-w-0 flex-1 ${flying ? "flag-plate px-2 py-1" : ""}`}>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`truncate text-[0.9375rem] font-semibold ${champion ? "text-gold" : "text-ink"}`}
            >
              {champion && (
                <Glyph name="crown" className="mr-1 inline h-3.5 w-3.5 -translate-y-px align-baseline" />
              )}
              {/* Away athletes fly their flag here too — the lane is where a
                  name is actually read, and it draws names directly rather than
                  through AthleteName. */}
              {awayFlag ? (
                <>
                  <FlagName name={row.athlete.name} flag={awayFlag} />
                  <FlagTag flag={awayFlag} />
                </>
              ) : (
                row.athlete.name
              )}
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
            {scored && row.awardedPoints > 0 && (
              <div
                className="bg-ink-3"
                style={{ width: `${(row.awardedPoints / row.points) * width * 100}%` }}
                title={`Awarded: ${fmtPoints(row.awardedPoints)} pts`}
              />
            )}
            {scored && row.excusedPoints > 0 && (
              <div
                style={{
                  width: `${(row.excusedPoints / row.points) * width * 100}%`,
                  backgroundImage: GRANT_HATCH,
                }}
                title={`Excused: ${fmtPoints(row.excusedPoints)} pts`}
              />
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[0.6875rem] leading-tight text-ink-3">
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
  const figures = useFigures();
  const ui = SPORT_UI[sport];
  const isFlat = SPORT_UNIT[sport] === "flat";
  const has = row.value > 0;
  const width = top > 0 ? Math.max(row.value / top, 0) : 0;

  return (
    <button
      onClick={onSelect}
      className={`lane-enter block w-full rounded-xl px-3 py-1 text-left transition-colors ${
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

        {figures ? (
          <Figure athlete={row.athlete} flag={null} className="w-11" />
        ) : (
          <Avatar athlete={row.athlete} me={isMe} />
        )}

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

/**
 * A lane on the climbing board.
 *
 * The bar is split bike/run rather than filled with one colour, because the
 * split is the story: two athletes on the same total got there completely
 * differently, and on this board that difference is the only thing
 * distinguishing a rider from a runner.
 */
function ClimbLane({
  row,
  top,
  isMe,
  index,
  champion,
  onSelect,
}: {
  row: ClimbRow;
  top: number;
  isMe: boolean;
  index: number;
  champion?: boolean;
  onSelect: () => void;
}) {
  const figures = useFigures();
  const has = row.total > 0;
  const width = top > 0 ? Math.max(row.total / top, 0) : 0;

  return (
    <button
      onClick={onSelect}
      className={`lane-enter block w-full rounded-xl px-3 py-1 text-left transition-colors ${
        isMe ? "bg-tile ring-2 ring-ink" : "hover:bg-tile/60"
      }`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className="flex w-8 shrink-0 flex-col items-center">
          <span className={`stamp text-2xl ${row.rank === 1 && has ? "text-gold" : "text-ink-3"}`}>
            {has ? row.rank : "—"}
          </span>
          <span className="eyebrow text-[0.5rem] text-ink-3">lane</span>
        </div>

        {figures ? (
          <Figure athlete={row.athlete} flag={null} className="w-11" />
        ) : (
          <Avatar athlete={row.athlete} me={isMe} />
        )}

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
              <span className={`stamp text-xl ${has ? "text-gold" : "text-ink-3"}`}>
                {fmtMetres(row.total)}
              </span>
              <span className="eyebrow ml-1 text-ink-3">m up</span>
            </span>
          </div>

          <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-deck-2">
            {has &&
              CLIMB_SPORTS.map((s) => {
                const share = row.bySport[s] / row.total;
                if (share <= 0) return null;
                return (
                  <div
                    key={s}
                    className={SPORT_UI[s].bg}
                    style={{ width: `${share * width * 100}%` }}
                    title={`${SPORT_UI[s].label}: ${fmtMetres(row.bySport[s])} m`}
                  />
                );
              })}
          </div>

          {has && (
            <div className="mt-1 font-mono text-[0.6875rem] text-ink-3">
              {CLIMB_SPORTS.filter((s) => row.bySport[s] > 0)
                .map((s) => `${SPORT_UI[s].label.toLowerCase()} ${fmtMetres(row.bySport[s])}`)
                .join("  ·  ")}
              {"  ·  "}
              {row.sessions} session{row.sessions === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * The two discipline crowns under the board.
 *
 * They exist because they are frequently NOT the same person as the winner
 * above, and that is the most interesting thing this board knows: the overall
 * total goes to whoever rides the most, while the running crown routinely lands
 * on someone near the bottom of the points table.
 */
function ClimbSubTitles({ rows }: { rows: ClimbRow[] }) {
  const crowns = CLIMB_SPORTS.map((s) => ({ sport: s, best: climbLeader(rows, s) })).filter(
    (c) => c.best,
  );
  if (crowns.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {crowns.map(({ sport, best }) => (
        <div key={sport} className="rounded-xl border border-line bg-tile px-3 py-2">
          <div className="eyebrow flex items-center gap-1 text-ink-3">
            <SportMark sport={sport} className={`h-3 w-3 ${SPORT_UI[sport].text}`} />
            best on {SPORT_UI[sport].label.toLowerCase()}
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-ink">{best!.athlete.name}</div>
          <div className="stamp text-base text-gold">
            {fmtMetres(best!.metres)}
            <span className="eyebrow ml-1 text-ink-3">m</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BoardChevron({ dir }: { dir: "left" | "right" }) {
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
