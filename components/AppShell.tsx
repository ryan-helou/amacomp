"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, parseDayKey, todayWithReset, weekStart, type DayKey } from "@/lib/dates";
import { fmtPoints, standingsFor } from "@/lib/scoring";
import { seasonChampions, seasonFor } from "@/lib/season";
import type { AppState } from "@/lib/types";
import { useLeague } from "./useLeague";
import { LoginScreen } from "./LoginScreen";
import { LogTab } from "./LogTab";
import { WeekTab } from "./WeekTab";
import { BoardTab } from "./BoardTab";
import { FeedTab } from "./FeedTab";
import { TitlesTab } from "./TitlesTab";
import { ScoringSheet } from "./ScoringSheet";
import { Confetti } from "./Confetti";
import { PullToRefresh } from "./PullToRefresh";
import { Glyph } from "./Glyph";

type Tab = "log" | "week" | "board" | "titles" | "feed";

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "August 10" — used in the pre-kickoff warm-up banner. */
function formatKickoff(key: DayKey): string {
  const d = parseDayKey(key);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
}

// Log sits dead-centre so it's under the thumb — it's the primary action. Its
// neighbours are the tabs you'd hop to right after logging: Week (am I hitting
// quota?) and Board (where do I stand?). Feed and Titles bracket the edges as
// the social and aspirational tabs.
const TABS: { id: Tab; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "week", label: "Week" },
  { id: "log", label: "Log" },
  { id: "board", label: "Board" },
  { id: "titles", label: "Titles" },
];

export function AppShell({
  initial,
  serverToday,
}: {
  initial: AppState;
  serverToday: DayKey;
}) {
  const league = useLeague(initial);
  const { state, busy, send } = league;
  const [tab, setTab] = useState<Tab>("week");
  const [scoringOpen, setScoringOpen] = useState(false);

  // Start from the server's day so the first client render matches the markup,
  // then hand over to the device's own calendar. A home-screen app is usually
  // resumed rather than loaded, so waking up re-reads both the date and the board.
  // Each athlete's day can roll over later than midnight (their resetHour), so
  // "today" is the device clock shifted back by that many hours.
  const resetHour = state.me?.resetHour ?? 0;
  const [refDay, setRefDay] = useState<DayKey>(serverToday);
  useEffect(() => {
    // The device clock is the source of truth for "today". Reconcile the
    // server-rendered day with it on mount (the one legitimate setState here),
    // then re-sync the date and refetch whenever the home-screen app resumes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefDay(todayWithReset(resetHour));
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      setRefDay(todayWithReset(resetHour));
      send("/api/session");
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [send, resetHour]);

  // Pull-to-refresh + resume both do the same thing: re-read the calendar day
  // and refetch the whole board.
  const refresh = useCallback(async () => {
    setRefDay(todayWithReset(resetHour));
    await send("/api/session");
  }, [send, resetHour]);

  // Week standing for the signed-in athlete — drives the header total and the
  // one-time "you hit quota" confetti.
  const week = standingsFor(
    state.athletes,
    state.activities,
    state.settings,
    "week",
    refDay,
  );
  const mine = week.find((s) => s.athlete.id === state.me?.id);
  const myWeekPoints = mine?.points ?? 0;

  // After the Strava OAuth round-trip we land back here with ?strava=…; the page
  // already re-rendered with the fresh connection + imported sessions, so this
  // just confirms it and strips the param from the URL.
  const [stravaMsg, setStravaMsg] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const st = params.get("strava");
    if (!st) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot on mount, reading the OAuth return param
    setStravaMsg(
      st === "connected"
        ? "Strava linked — your recent sessions are importing."
        : "Strava didn't finish connecting. Give it another go.",
    );
    params.delete("strava");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    const timer = setTimeout(() => setStravaMsg(null), 5000);
    return () => clearTimeout(timer);
  }, []);

  const [fireKey, setFireKey] = useState(0);
  useEffect(() => {
    const goal = state.settings.weeklyGoal;
    if (!state.me || goal <= 0 || myWeekPoints < goal) return;
    // Celebrate crossing the quota once per athlete per week.
    const key = `amacomp-celebrated-${state.me.id}-${weekStart(refDay)}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFireKey((k) => k + 1);
  }, [state.me, myWeekPoints, state.settings.weeklyGoal, refDay]);

  // Seasons — a kickoff banner for the first week a season is live, and a
  // one-time "season champion" celebration once a season has finished.
  const curSeason = seasonFor(refDay, state.settings.seasonStart);
  const seasonLiveDay = curSeason
    ? curSeason.number === 1
      ? state.settings.seasonStart // Season 1 goes live at the configured kickoff
      : curSeason.start
    : null;
  const inKickoffWeek =
    !!curSeason && !!seasonLiveDay && refDay >= seasonLiveDay && refDay <= addDays(seasonLiveDay, 6);

  const seasons = useMemo(
    () =>
      seasonChampions(
        state.athletes,
        state.activities,
        state.settings,
        refDay,
        state.settings.seasonStart,
      ),
    [state.athletes, state.activities, state.settings, refDay],
  );
  const crownedRef = useRef(false);
  const [crownMsg, setCrownMsg] = useState<string | null>(null);
  useEffect(() => {
    if (crownedRef.current || !state.me) return;
    // The most recently finished season that actually crowned someone.
    const ended = seasons.find((s) => s.status === "past" && s.champion);
    if (!ended?.champion) return;
    const key = `amacomp-crowned-${ended.season.number}`;
    let already: boolean;
    try {
      already = localStorage.getItem(key) !== null;
    } catch {
      return;
    }
    // Claim it synchronously so React's dev double-invoke can't re-run past here.
    crownedRef.current = true;
    if (already) return;
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* private mode — the ref still dedupes this session */
    }
    const champ = ended.champion;
    const iWon = champ.athlete.id === state.me.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot per season, gated by ref + localStorage
    setCrownMsg(
      iWon
        ? `You won ${ended.season.label} — ${fmtPoints(champ.points)} pts. Champion.`
        : `${ended.season.label} champion: ${champ.athlete.name} — ${fmtPoints(champ.points)} pts.`,
    );
    setFireKey((k) => k + 1);
  }, [seasons, state.me]);

  // Auto-dismiss the crown banner from its own effect, so the timer can't race
  // the one-shot celebration effect's dev double-invoke.
  useEffect(() => {
    if (!crownMsg) return;
    const timer = setTimeout(() => setCrownMsg(null), 6500);
    return () => clearTimeout(timer);
  }, [crownMsg]);

  if (!state.me) {
    return (
      <LoginScreen
        settings={state.settings}
        busy={busy}
        onSubmit={(name) =>
          send("/api/session", { method: "POST", body: JSON.stringify({ name }) })
        }
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <PullToRefresh onRefresh={refresh} />
      <header className="sticky top-0 z-30 border-b-2 border-ink bg-deck px-5 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="stamp text-2xl leading-none text-ink">AMACOMP</h1>
            <p className="eyebrow mt-1 text-ink-3">
              {state.me.name}
              {state.isAdmin && " · admin"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="stamp text-xl">
                <span className="accent-text">{fmtPoints(mine?.points ?? 0)}</span>
                <span className="text-ink-3">/{fmtPoints(state.settings.weeklyGoal)}</span>
              </div>
              <div className="eyebrow text-ink-3">this week</div>
            </div>
            <button
              onClick={() => setScoringOpen(true)}
              aria-label="Settings"
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-line bg-tile text-ink-2"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[18px] w-[18px]"
                aria-hidden
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {refDay < state.settings.seasonStart ? (
        <div className="border-b-2 border-gold/40 bg-gold/10 px-5 py-2.5 text-center">
          <p className="eyebrow text-gold">Warm-up mode</p>
          <p className="mt-0.5 text-xs text-ink-2">
            Log freely — every board resets when the season kicks off {formatKickoff(state.settings.seasonStart)}.
          </p>
        </div>
      ) : inKickoffWeek && curSeason ? (
        <div className="border-b-2 border-accent/30 bg-accent/5 px-5 py-2.5 text-center">
          <p className="eyebrow accent-text">{curSeason.label} is live</p>
          <p className="mt-0.5 text-xs text-ink-2">
            {curSeason.monthsLabel} · fresh board, two months to prove it.
          </p>
        </div>
      ) : null}

      <main className="flex-1 px-5 pb-28 pt-5">
        {tab === "log" && <LogTab league={league} refDay={refDay} />}
        {tab === "week" && <WeekTab state={state} refDay={refDay} />}
        {tab === "board" && <BoardTab state={state} refDay={refDay} />}
        {tab === "titles" && <TitlesTab state={state} refDay={refDay} />}
        {tab === "feed" && <FeedTab league={league} refDay={refDay} />}
      </main>

      {/* Solid background + its own compositing layer: iOS WebKit mis-repaints a
          fixed bar that has backdrop-blur during momentum scroll (it detaches
          mid-screen); translateZ(0) keeps it pinned. */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t-2 border-ink bg-deck px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 [transform:translateZ(0)]"
      >
        <div className="flex">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={on ? "page" : undefined}
                className="flex flex-1 flex-col items-center gap-1.5 py-1.5"
              >
                <span
                  className={`eyebrow ${on ? "accent-text" : "text-ink-3"}`}
                >
                  {t.label}
                </span>
                <span
                  aria-hidden
                  className={`h-1 w-7 rounded-full transition-colors ${
                    on ? "accent-fill" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>

      {stravaMsg && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-md px-5">
          <div className="rounded-xl border-2 border-ink bg-deck px-4 py-3 text-sm font-medium text-ink shadow-lg">
            {stravaMsg}
          </div>
        </div>
      )}

      {crownMsg && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-md px-5">
          <div className="flex items-center gap-2 rounded-xl border-2 border-gold bg-deck px-4 py-3 text-sm font-medium text-ink shadow-lg">
            <span className="text-gold">
              <Glyph name="trophy" className="h-5 w-5" />
            </span>
            {crownMsg}
          </div>
        </div>
      )}

      {scoringOpen && (
        <ScoringSheet league={league} onClose={() => setScoringOpen(false)} />
      )}

      <Confetti fireKey={fireKey} />
    </div>
  );
}
