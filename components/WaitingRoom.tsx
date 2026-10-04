"use client";

import type { SeasonInfo } from "@/lib/season";
import { daysBetween, formatDay } from "@/lib/dates";
import type { DayKey } from "@/lib/dates";

/**
 * The holding screen for a man who has joined but has nothing to look at yet.
 *
 * Ryan, 2026-10-03: George is installing the app three days before Season 2
 * opens. Without this he signs in and lands on a board where everyone else has
 * fifteen hundred points and he has none, in the last two days of a season he
 * was never in — which reads as "you are losing badly", not "you are early".
 *
 * So: anyone with nothing logged, before the next season opens, gets told what
 * he is waiting for and when it starts. It costs nothing to be right about
 * this — the moment he logs a session, or the season opens, the condition goes
 * false on its own and he never sees it again.
 *
 * Ryan, 2026-10-03: "only show a coming soon screen and nothing else." So
 * there is no way past it. A dismiss button would put him on a Season 1 board
 * he was never in, two days from the end, in last place by fifteen hundred
 * points — which is the exact impression this screen exists to prevent. It
 * lifts itself on Monday.
 */
export function WaitingRoom({
  name,
  season,
  today,
}: {
  name: string;
  /** The season he is waiting for. */
  season: SeasonInfo;
  today: DayKey;
}) {
  const days = Math.max(0, daysBetween(today, season.start));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${season.label} starts soon`}
      className="fixed inset-0 z-[60] overflow-hidden text-white"
      style={{ backgroundColor: "#081722", animation: "sk-veil 420ms ease-out both" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(115% 55% at 50% -10%, rgba(61,90,255,0.30) 0%, transparent 55%)," +
            "radial-gradient(90% 45% at 50% 108%, rgba(176,131,7,0.20) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 75% at 50% 42%, transparent 38%, rgba(3,10,16,0.74) 100%)",
        }}
      />

      <div className="relative flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="flex min-h-0 flex-1 flex-col justify-center text-center">
          <p
            className="font-mono text-[0.6875rem] tracking-[0.22em] text-white/40"
            style={{ animation: "sk-rise 420ms ease-out 0.05s both" }}
          >
            {name.toUpperCase()} · YOU&rsquo;RE IN
          </p>

          <p
            className="stamp mt-2 leading-[1.02] text-white"
            style={{
              fontSize: "clamp(1.9rem, 9.5vw, 2.9rem)",
              animation: "sk-headline 760ms cubic-bezier(0.16, 1, 0.3, 1) 0.15s both",
            }}
          >
            SEASON{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(168deg, #ffeaa4 0%, #e2b53d 46%, #b98d09 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 3px 16px rgba(226,181,61,0.45))",
              }}
            >
              {season.number}
            </span>
          </p>

          {/* The number is the whole point of the screen: he is early, not losing. */}
          <div className="mt-6" style={{ animation: "sk-rise 600ms ease-out 0.4s both" }}>
            <p
              className="stamp leading-none"
              style={{
                fontSize: "clamp(4rem, 26vw, 7rem)",
                backgroundImage: "linear-gradient(168deg, #ffeaa4 0%, #e2b53d 46%, #b98d09 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {days}
            </p>
            <p className="eyebrow mt-1 text-white/45">
              {days === 1 ? "day to go" : days === 0 ? "it starts today" : "days to go"}
            </p>
          </div>

          <p
            className="mt-6 text-balance text-[0.9375rem] leading-relaxed text-white/60"
            style={{ animation: "sk-rise 560ms ease-out 0.55s both" }}
          >
            Nothing is running yet. The board opens on{" "}
            <span className="font-semibold text-white">{formatDay(season.start)}</span> and
            everyone starts on zero — including the five who have been at it since August.
          </p>
        </div>

        {/* No way through. What there is instead is the one thing he can
            usefully do before Monday. */}
        <div className="shrink-0" style={{ animation: "sk-rise 560ms ease-out 0.75s both" }}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
            <p className="eyebrow pb-2 text-white/40">While you wait</p>
            <ul className="space-y-2 text-left">
              {[
                // Nothing here asks him to go and do something, because there
                // is nowhere for him to go — the screen has no way out.
                "100 points a week is the quota. Miss it and there's a forfeit.",
                "Swim, bike, run and gym all score. Strava logs itself once you link it.",
                "Your man is already made — he's built from your name.",
                "Monday morning this screen turns into the board.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-[0.8125rem] text-white/70">
                  <span aria-hidden className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-white/40" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
