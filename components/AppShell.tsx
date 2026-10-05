"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, logToday, parseDayKey, today, weekStart, type DayKey } from "@/lib/dates";
import { fmtPoints, goalFor, standingsFor, standingsForRange } from "@/lib/scoring";
import { reigningChampionId, reigningPodium, seasonByNumber, seasonChampions, seasonFor, seasonOpensOn } from "@/lib/season";
import type { AppState } from "@/lib/types";
import { announcementIsDue, rateAnnouncementFor, type RateAnnouncement } from "@/lib/announce";
import { useLeague } from "./useLeague";
import { LoginScreen } from "./LoginScreen";
import { LogTab } from "./LogTab";
import { WeekTab } from "./WeekTab";
import { BoardTab } from "./BoardTab";
import { RecordsAndFame } from "./RecordsAndFame";
import { ClubTab } from "./ClubTab";
import { ScoringSheet } from "./ScoringSheet";
import { HouseRulesSheet } from "./HouseRulesSheet";
import { Confetti } from "./Confetti";
import { SeasonKickoff } from "./SeasonKickoff";
import { WaitingRoom } from "./WaitingRoom";
import { waitingFor } from "@/lib/waiting";
import { SeasonMoment } from "./SeasonMoment";
import { seasonMomentFor, type SeasonMoment as Moment } from "@/lib/seasonMoment";
import { PointsChange } from "./PointsChange";
import { PullToRefresh } from "./PullToRefresh";
import { Glyph } from "./Glyph";
import { ProfileProvider, AthleteName } from "./ProfileContext";
import { LoadoutsProvider } from "./AthleteFigure";
import { CLUB_LIVE, canSeeClub, championWithTestMode } from "@/lib/club";

type Tab = "log" | "week" | "board" | "records" | "club" | "arena";

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "August 10" — used in the pre-kickoff warm-up banner. */
function formatKickoff(key: DayKey): string {
  const d = parseDayKey(key);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
}

// Log sits dead-centre so it's under the thumb — it's the primary action. To its
// left are the two "where do I stand right now" tabs, Week then Board; to its
// right Records — the record book, the Hall of Fame and the titles, behind one
// toggle — and then the Club, where the coins live. Reading left to right the
// nav goes from this week to all time to the side game.
/**
 * The bar, in two arrangements.
 *
 * Ryan, 2026-09-30: logging moves to a + at the top and the Club splits in
 * two. That is his bar; the league keeps the one it knows until he says to
 * send it to everyone. Same door as the figures — one name, one check.
 *
 * Logging earns a + rather than a tab because it is the one thing here you
 * come to DO. The other four are things you come to look at, and a verb sat
 * among four nouns.
 */
const TABS: { id: Tab; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "board", label: "Board" },
  { id: "log", label: "Log" },
  { id: "records", label: "Records" },
  { id: "club", label: "Club" },
];

const RYAN_TABS: { id: Tab; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "board", label: "Board" },
  { id: "records", label: "Records" },
  { id: "club", label: "Club" },
  { id: "arena", label: "Bets" },
];

export function AppShell({
  initial,
  serverToday,
  serverLogDay,
}: {
  initial: AppState;
  /** The real calendar day on the server — what the app shows. */
  serverToday: DayKey;
  /** The day a session logged right now counts for; differs from `serverToday`
   *  only while a rollover grace window is set, which it isn't today. Rendered server-side too, so
   *  the log form doesn't flash the wrong date during that window. */
  serverLogDay: DayKey;
}) {
  const league = useLeague(initial);
  const { state, busy, send } = league;
  const [tab, setTab] = useState<Tab>("week");
  // ONE DOOR. The "+" button, the split Club/Bets tabs, the pixel figures, the
  // Club's rooms, the shop's till and the Arena's API all ask this same
  // question: Ryan always, the rest of the league once CLUB_LIVE is on.
  //
  // It is one question because every time it has been two, something has come
  // apart at the seam — a man who could accept a bet with no tab to see it in,
  // and a shop he could browse but not buy from. Throwing the switch has to
  // open all of it or none of it.
  const newShape = CLUB_LIVE || canSeeClub(state.me?.name);
  const tabs = newShape ? RYAN_TABS : TABS;
  const [logOpen, setLogOpen] = useState(false);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  // Start from the server's day so the first client render matches the markup,
  // then hand over to the device's own calendar. A home-screen app is usually
  // resumed rather than loaded, so waking up re-reads both the date and the board.
  //
  // TWO days, not one. `refDay` is the real calendar day and drives everything
  // the athlete looks at. `logDay` is the day a session logged right now counts
  // for. The rollover is midnight (RESET_HOUR = 0 in lib/dates), so today they
  // are always the same answer — they stay separate because a grace window is a
  // setting, and putting one back shouldn't mean auditing every screen.
  const [refDay, setRefDay] = useState<DayKey>(serverToday);
  const [logDay, setLogDay] = useState<DayKey>(serverLogDay);
  useEffect(() => {
    // The device clock is the source of truth for "today". Reconcile the
    // server-rendered day with it on mount (the one legitimate setState here),
    // then re-sync the dates and refetch whenever the home-screen app resumes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefDay(today());
    setLogDay(logToday());
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      setRefDay(today());
      setLogDay(logToday());
      send("/api/session");
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [send]);

  // Pull-to-refresh + resume both do the same thing: re-read the calendar day
  // and refetch the whole board.
  const refresh = useCallback(async () => {
    setRefDay(today());
    setLogDay(logToday());
    await send("/api/session");
  }, [send]);

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
  // Your own quota — the header fraction reads against the goal that judges you.
  const myGoal = mine?.goal ?? state.settings.weeklyGoal;

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

  // The season kickoff card. Shown once per athlete per season, on the first
  // open on or after the day the season opens — Season 1 opens on the configured
  // Monday kickoff, later seasons on the 1st of their first month. Bounded to
  // the opening week so it stays a kickoff rather than a mid-season surprise for
  // anyone who's been away. localStorage, so it's per-device and needs no schema.
  const [kickoffSeason, setKickoffSeason] = useState<ReturnType<typeof seasonFor>>(null);
  useEffect(() => {
    if (!state.me) return;
    // ?intro=2 forces the card for a given season, marker and window ignored.
    // A card that only exists in the first week of a season is a card nobody
    // can look at while they are still writing it — this is how it gets read
    // before Monday. You have to type it, so nobody meets it by accident.
    const forced = new URLSearchParams(window.location.search).get("intro");
    const asked = forced === null ? null : Number(forced);
    const season = asked && Number.isFinite(asked) && asked > 0
      ? seasonByNumber(asked, state.settings.seasonStart)
      : seasonFor(refDay, state.settings.seasonStart);
    if (!season) return;

    if (forced === null) {
      const opensOn = seasonOpensOn(season);
      if (refDay < opensOn || refDay > addDays(opensOn, 6)) return;
      const key = `amacomp-season-intro-${state.me.id}-${season.number}`;
      try {
        if (localStorage.getItem(key)) return;
        // Marked as seen up front: a reload or a crash mid-animation shouldn't
        // replay it, and the card is a moment rather than something to re-earn.
        localStorage.setItem(key, "1");
      } catch {
        return; // private mode — skip rather than replay it on every open
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot on mount, gated by a localStorage marker
    setKickoffSeason(season);
  }, [state.me, state.settings.seasonStart, refDay]);

  // The scoring-change card. Same shape as the kickoff above: derived from
  // settings rather than hard-coded, gated on the athlete's own clock, and
  // marked seen up front so a reload can't replay it. It waits until 6 AM on the
  // day a change starts — inside a rollover window a session is still being
  // logged into yesterday at yesterday's rates, and announcing the new ones then
  // would be telling the athlete something untrue about the run in front of them.
  const [pointsChange, setPointsChange] = useState<RateAnnouncement | null>(null);
  useEffect(() => {
    if (!state.me) return;
    // ?rates shows the card for the most recent change whatever the date is —
    // the same preview door as ?intro and ?moment. A card that fires at 6 AM on
    // one morning a season cannot otherwise be looked at.
    const forced = new URLSearchParams(window.location.search).has("rates");
    const changes = state.settings.rateChanges ?? [];
    const last = changes[changes.length - 1];
    const announcement = forced && last
      ? rateAnnouncementFor(last.from, state.settings)
      : rateAnnouncementFor(refDay, state.settings);
    if (!announcement) return;

    if (!forced) {
      if (!announcementIsDue(announcement, refDay, new Date().getHours())) return;
      const key = `amacomp-rates-${state.me.id}-${announcement.from}`;
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "1");
      } catch {
        return; // private mode — skip rather than replay it on every open
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, gated by a localStorage marker
    setPointsChange(announcement);
  }, [state.me, state.settings, refDay]);

  const [fireKey, setFireKey] = useState(0);
  useEffect(() => {
    const goal = goalFor(state.me?.name, state.settings, weekStart(refDay));
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
  }, [state.me, myWeekPoints, state.settings, refDay]);

  // Seasons — a one-time "season champion" celebration once a season has
  // finished. (The in-app "season is live" banner was retired; the full-screen
  // kickoff card still marks the start of a season.)
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
  const championId = useMemo(
    () => championWithTestMode(
      reigningChampionId(state.athletes, state.activities, state.settings, refDay),
      state.me,
    ),
    [state.athletes, state.activities, state.settings, refDay, state.me],
  );
  // Second and third of the last finished season wear a circlet. Computed
  // here beside the champion so both come off the same reference day.
  const podium = useMemo(() => {
    const real = reigningPodium(state.athletes, state.activities, state.settings, refDay);
    if (real.length || !championId) return real;
    // Test mode: the champion is standing on a podium of one, so second and
    // third come off the live season's table — otherwise the circlets have
    // nobody to sit on and half the thing can't be looked at.
    // Read the live table here rather than leaning on the one the header
    // uses: that one is a fresh array every render, which the compiler
    // refuses to accept as a dependency.
    const live = standingsFor(state.athletes, state.activities, state.settings, "all", refDay)
      .filter((r) => r.athlete.id !== championId)
      .slice(0, 2);
    return [championId, ...live.map((r) => r.athlete.id)];
  }, [state.athletes, state.activities, state.settings, refDay, championId]);
  /**
   * The season's own moments — the champion card that closes a season, and the
   * two that count it down. Siblings of the kickoff: same ink ground, same
   * once-per-athlete localStorage marker, same bounded window.
   *
   * On the first day of a new season BOTH this and the kickoff are due, and
   * they run in that order — you close the old season before you open the new
   * one, so the champion is crowned and then Season n starts.
   */
  const [moment, setMoment] = useState<Moment | null>(null);
  useEffect(() => {
    if (!state.me) return;
    const params = new URLSearchParams(window.location.search);
    // Asking for another card by name means this one must not jump the queue
    // in front of it — otherwise previewing the kickoff during the run-in week
    // shows the countdown instead of the thing you asked to see.
    if (params.has("intro") || params.has("rates")) return;
    const forced = params.get("moment");
    // ?moment=champion BUILDS that card rather than waiting for the one week a
    // year it is due, the same way ?intro= forces the kickoff. Filtering the
    // natural answer would not do: no day in the calendar is both today and
    // the opening week of a season, so the champion card could never be looked
    // at while it was being written.
    const cur = seasonFor(refDay, state.settings.seasonStart);
    let due: Moment | null = null;
    if (forced && cur) {
      const prev = seasonByNumber(Math.max(1, cur.number - 1), state.settings.seasonStart);
      due = forced === "champion" ? { kind: "champion", season: prev } : null;
    } else {
      due = seasonMomentFor(refDay, state.settings.seasonStart);
    }
    if (!due) return;
    if (!forced) {
      const key = `amacomp-moment-${due.kind}-${state.me.id}-${due.season.number}`;
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "1");
      } catch {
        return;
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot on mount, gated by a localStorage marker
    setMoment(due);
  }, [state.me, state.settings.seasonStart, refDay]);

  /**
   * The waiting room, for a man who has joined before there is anything to
   * join. It is the WHOLE app for him until the season opens — no marker, no
   * dismiss: Ryan's call, because the only thing behind it is a board he was
   * never in and is last on.
   *
   * `?waiting` forces it, the same preview door as the other cards.
   */
  const waiting = useMemo(() => {
    const forced = typeof window !== "undefined"
      && new URLSearchParams(window.location.search).has("waiting");
    if (forced) {
      const cur = seasonFor(refDay, state.settings.seasonStart);
      return cur ? seasonByNumber(cur.number + 1, state.settings.seasonStart) : null;
    }
    return waitingFor(state.me, state.activities, state.settings, refDay);
  }, [state.me, state.activities, state.settings, refDay]);

  /** The table a moment is about: its own season, best first. */
  const momentTable = useMemo(
    () => (moment
      ? standingsForRange(state.athletes, state.activities, state.settings, [
          moment.season.start, moment.season.end,
        ])
      : []),
    [moment, state.athletes, state.activities, state.settings],
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
        refDay={refDay}
        busy={busy}
        onSubmit={(name) =>
          send("/api/session", { method: "POST", body: JSON.stringify({ name }) })
        }
      />
    );
  }

  // Nothing else, Ryan's call: the waiting room IS the app until his season
  // opens. Rendering the board behind it would leave a man who cannot see it
  // still able to tab into it, and anything slow to paint would flash a table
  // he is bottom of before the card lands on top.
  if (waiting && state.me) {
    return <WaitingRoom name={state.me.name} season={waiting} today={refDay} />;
  }

  return (
    <ProfileProvider state={state} refDay={refDay} championId={championId} podium={podium} send={send}>
    <LoadoutsProvider loadouts={state.loadouts} showFigures={newShape} champion={championId}>
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <PullToRefresh onRefresh={refresh} />
      {/* The notch strip.

          `body` is padded by the top safe-area inset so the app sits under the
          notch, which means the strip above that padding is not covered by
          anything in the flow — scrolled content travels through it, under the
          clock. The header used to hide that by being `sticky top-0`: pinned,
          its opaque deck covered the strip. That only held while the pin was
          keeping up. On Ryan's iPhone it did not, and the period tabs painted
          into the strip above the header, clipped by the top of the screen.

          So the cover is now its own element and owns the job outright: fixed,
          exactly the height of the inset, opaque, no blur, and it never moves.
          It collapses to nothing on a device with no inset. Below the pull-to-
          refresh spinner and any sheet, above everything that scrolls. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[35] bg-deck"
        style={{ height: "env(safe-area-inset-top)" }}
      />
      {/* Deliberately NOT sticky — see the note above. It scrolls away like the
          rest of the page, so there is no pinned element at the top of the
          screen for content to collide with or paint over. */}
      <header className="relative z-10 border-b border-line-2 bg-deck px-5 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              aria-label="House rules"
              className="block text-left"
            >
              <h1 className="stamp text-2xl leading-none text-ink">AMACOMP</h1>
            </button>
            <p className="eyebrow mt-1 text-ink-3">
              <AthleteName id={state.me.id} name={state.me.name} />
              {state.isAdmin && " · admin"}
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                aria-label="House rules"
                className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink-3 align-middle text-[0.5625rem] font-bold leading-none text-ink-3"
              >
                ?
              </button>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="stamp text-xl">
                <span className="accent-text">{fmtPoints(mine?.points ?? 0)}</span>
                <span className="text-ink-3">/{fmtPoints(myGoal)}</span>
              </div>
              <div className="eyebrow text-ink-3">this week</div>
            </div>
            {newShape && (
              <button
                onClick={() => setLogOpen(true)}
                aria-label="Log a session"
                className="flex h-10 w-10 items-center justify-center rounded-full pane border border-gold/60 bg-gold/15 text-gold"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setScoringOpen(true)}
              aria-label="Settings"
              className="flex h-10 w-10 items-center justify-center rounded-full pane border border-line bg-tile text-ink-2"
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

      {refDay < state.settings.seasonStart && (
        <div className="border-b-2 border-gold/40 bg-gold/10 px-5 py-2.5 text-center">
          <p className="eyebrow text-gold">Warm-up mode</p>
          <p className="mt-0.5 text-xs text-ink-2">
            Log freely — every board resets when the season kicks off {formatKickoff(state.settings.seasonStart)}.
          </p>
        </div>
      )}

      <main className="flex-1 px-5 pb-36 pt-5">
        {tab === "log" && !newShape && <LogTab league={league} refDay={refDay} logDay={logDay} />}
        {tab === "week" && <WeekTab league={league} refDay={refDay} logDay={logDay} />}
        {tab === "board" && <BoardTab state={state} refDay={refDay} />}
        {tab === "club" && <ClubTab state={state} refDay={refDay} send={send} house="club" />}
        {tab === "arena" && <ClubTab state={state} refDay={refDay} send={send} house="arena" />}
        {tab === "records" && <RecordsAndFame state={state} refDay={refDay} />}
      </main>

      {/* The tab island.

          THE WRAPPER IS WHAT IS FIXED, AND IT IS EMPTY: no background, no
          filter, no compositing hint, nothing to repaint. The island inside it
          is an ordinary element that happens to sit there. This is the iOS bug
          this app is where we first saw — a fixed bar repainted at a stale
          position during momentum scroll, floating over the middle of the
          leaderboard.

          NOTHING PROMOTES THIS WRAPPER. It used to carry `island-layer`
          (translateZ(0) + will-change: transform), left over from the days when
          the island blurred and the layer was half of that mitigation. The blur
          went in Aug 2026 and the hint stayed, doing no work — and on
          2026-09-11 Ryan's iPhone floated the island over the list again. A
          promoted FIXED layer is the same hazard as a blurred one: the
          compositor keeps its own snapshot and hands it back at a stale
          scroll position. Do not add transform, will-change, filter or
          backdrop-filter here or to any ancestor. The escape hatch and the full
          rule are written at the top of globals.css.

          The offset clears the safe area rather than sitting inside it, so the
          island reads as floating well clear of the edge: about 26px of screen
          under it on a phone with a home indicator, and 12px on a device with
          no inset. The floor here is the indicator itself — it occupies roughly
          the bottom 13px and the system swipe intercepts touches over it, so
          dropping much below this starts eating taps on the outer tabs rather
          than just looking tighter. Raising it is always safe. */}
      <nav
        aria-label="Sections"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)-0.5rem))]"
      >
        <div className="glass-island pointer-events-auto flex gap-1 rounded-[2rem] border border-line p-2">
          {tabs.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={on ? "page" : undefined}
                /* The active tab has a shape, not just a colour — at this size a
                   tinted label alone is easy to miss on a moving background. */
                className={`flex flex-1 items-center justify-center rounded-[1.5rem] py-3.5 transition-colors ${
                  on ? "border border-accent/30 bg-accent-soft" : "border border-transparent"
                }`}
              >
                {/* Deliberately NOT `.eyebrow`: that class lives outside
                    Tailwind's layer and wins on source order, so its 0.14em
                    tracking cannot be overridden here — and five labels at that
                    tracking do not fit across a 375px island. */}
                <span
                  className={`font-display text-[0.625rem] font-bold uppercase leading-none tracking-[0.05em] ${
                    on ? "accent-text" : "text-ink-3"
                  }`}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {stravaMsg && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-md px-5">
          <div className="rounded-xl border border-line-2 bg-deck px-4 py-3 text-sm font-medium text-ink shadow-lg">
            {stravaMsg}
          </div>
        </div>
      )}

      {crownMsg && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-md px-5">
          <div className="flex items-center gap-2 rounded-xl border border-gold bg-deck px-4 py-3 text-sm font-medium text-ink shadow-lg">
            <span className="text-gold">
              <Glyph name="trophy" className="h-5 w-5" />
            </span>
            {crownMsg}
          </div>
        </div>
      )}

      {/* The + opens the log as a sheet. It is the one thing in the app you
          come to DO rather than to read, so it gets a door of its own rather
          than a seat among the tabs — and it closes itself the moment a
          session saves, because the answer to "did that work" is the board
          behind it, not a form still sitting open. */}
      {logOpen && newShape && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <button
            aria-label="Close"
            onClick={() => setLogOpen(false)}
            className="absolute inset-0 bg-scrim"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Log a session"
            className="relative mt-auto max-h-[92dvh] overflow-y-auto glass-raised rounded-t-3xl border-t border-line-2 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-3" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="stamp text-xl text-ink">Log a session</h2>
              <button onClick={() => setLogOpen(false)} className="eyebrow text-ink-2">
                Close
              </button>
            </div>
            <LogTab
              league={league}
              refDay={refDay}
              logDay={logDay}
              onSaved={() => setLogOpen(false)}
            />
          </div>
        </div>
      )}

      {rulesOpen && (
        <HouseRulesSheet
          settings={state.settings}
          refDay={refDay}
          onClose={() => setRulesOpen(false)}
        />
      )}

      {scoringOpen && (
        <ScoringSheet
          league={league}
          refDay={refDay}
          onClose={() => setScoringOpen(false)}
          onOpenRules={() => {
            setScoringOpen(false);
            setRulesOpen(true);
          }}
        />
      )}

      <Confetti fireKey={fireKey} />

      {/* The kickoff card wins if both land on the same open — a season starting
          is the bigger news, and this one keeps its marker for next time. */}
      {!kickoffSeason && pointsChange && (
        <PointsChange
          announcement={pointsChange}
          onDismiss={() => setPointsChange(null)}
        />
      )}

      {/* The champion closes the old season before the kickoff opens the new
          one, so on day one you see the crowning and then SEASON n STARTS NOW. */}
      {moment && state.me && (
        <SeasonMoment
          moment={moment}
          table={momentTable}
          meId={state.me.id}
          onDismiss={() => setMoment(null)}
        />
      )}

      {!moment && kickoffSeason && state.me && (
        // The what's-new cards are SEASON 2's news. Season 3 gets a title card
        // and nothing behind the arrow until somebody writes it.
        <SeasonKickoff
          season={kickoffSeason}
          news={kickoffSeason.number === 2}
          onDismiss={() => setKickoffSeason(null)}
        />
      )}
    </div>
    </LoadoutsProvider>
    </ProfileProvider>
  );
}
