"use client";

import { useEffect, useState } from "react";
import { today, weekStart, type DayKey } from "@/lib/dates";
import { fmtPoints, standingsFor } from "@/lib/scoring";
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

type Tab = "log" | "week" | "board" | "titles" | "feed";

const TABS: { id: Tab; label: string }[] = [
  { id: "log", label: "Log" },
  { id: "week", label: "Week" },
  { id: "board", label: "Board" },
  { id: "titles", label: "Titles" },
  { id: "feed", label: "Feed" },
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
  const [refDay, setRefDay] = useState<DayKey>(serverToday);
  useEffect(() => {
    // The device clock is the source of truth for "today". Reconcile the
    // server-rendered day with it on mount (the one legitimate setState here),
    // then re-sync the date and refetch whenever the home-screen app resumes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefDay(today());
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      setRefDay(today());
      send("/api/session");
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [send]);

  // Week standing for the signed-in athlete — drives the header total and the
  // one-time "you hit quota" confetti.
  const week = standingsFor(state.athletes, state.activities, state.settings, "week", refDay);
  const mine = week.find((s) => s.athlete.id === state.me?.id);
  const myWeekPoints = mine?.points ?? 0;

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
      <header className="sticky top-0 z-30 border-b-2 border-ink bg-deck/95 px-5 pb-3 pt-4 backdrop-blur">
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
              aria-label="Scoring rules"
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-line bg-tile text-ink-2"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-[18px] w-[18px]"
                aria-hidden
              >
                <circle cx="12" cy="12" r="3.2" />
                <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 pb-28 pt-5">
        {tab === "log" && <LogTab league={league} refDay={refDay} />}
        {tab === "week" && <WeekTab state={state} refDay={refDay} />}
        {tab === "board" && <BoardTab state={state} refDay={refDay} />}
        {tab === "titles" && <TitlesTab state={state} refDay={refDay} />}
        {tab === "feed" && <FeedTab state={state} refDay={refDay} />}
      </main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t-2 border-ink bg-deck/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
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

      {scoringOpen && (
        <ScoringSheet league={league} onClose={() => setScoringOpen(false)} />
      )}

      <Confetti fireKey={fireKey} />
    </div>
  );
}
