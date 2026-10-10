"use client";

import { useEffect } from "react";
import { SPORT_UNIT, UNIT_ABBR, elevationRateLabel } from "@/lib/types";
import { SPORT_UI } from "@/lib/ui";
import { formatDay } from "@/lib/dates";
import type { RateAnnouncement } from "@/lib/announce";
import { SportMark } from "./SportMark";

/**
 * The scoring-change card — the second screen where the app goes dark.
 *
 * Deliberately the season kickoff's sibling rather than its twin: same pool-ink
 * ground and the same stacked stamp lockup, so it reads as the league speaking,
 * but the arrival is a hard cut and a set of rows that flip from the old rate to
 * the new one. A season starting is a celebration; the rules moving under your
 * feet is an announcement, and it should feel like one.
 *
 * No confetti and no sticker — both already mean something else here.
 */

// Beat sheet, in seconds.
const T_LINE1 = 0.2;
const T_LINE2 = 0.5;
const T_DATE = 0.85;
const T_ROWS = 1.05;
const T_ROW_STEP = 0.16;
const T_OUTRO = 0.35; // added after the last row

const TITLE_SIZE = "clamp(1.9rem, 9.5vw, 2.9rem)";

/**
 * What an all-time change rescored, in the word the lads use for it: "ride"
 * when only cycling moved, and so on. Ryan, 2026-10-10 — "every session" was
 * true but vague when the only thing rescored was the bike.
 */
function retroNoun(announcement: RateAnnouncement): string {
  const sports = new Set(announcement.moves.map((m) => m.sport));
  if (sports.size !== 1) return "session";
  const only = [...sports][0];
  return only === "bike" ? "ride" : only === "run" ? "run" : only === "swim" ? "swim" : "workout";
}

function rateText(value: number, sport: keyof typeof SPORT_UNIT, climb: boolean): string {
  // Climbing reads the way it was set — "1/33m", not "3.0303/100m".
  return climb ? elevationRateLabel(value) || "0" : `${value}/${UNIT_ABBR[SPORT_UNIT[sport]]}`;
}

export function PointsChange({
  announcement,
  onDismiss,
}: {
  announcement: RateAnnouncement;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const outro = T_ROWS + announcement.moves.length * T_ROW_STEP + T_OUTRO;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The points have changed"
      className="fixed inset-0 z-[60] overflow-hidden text-white"
      style={{ backgroundColor: "#081722", animation: "sk-veil 420ms ease-out both" }}
    >
      {/* Same light as the kickoff card, turned colder — this is news, not a party. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(115% 55% at 50% -10%, rgba(61,90,255,0.32) 0%, transparent 55%)," +
            "radial-gradient(90% 45% at 50% 108%, rgba(61,140,220,0.16) 0%, transparent 60%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-[-25%]"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(61,140,220,0.30), transparent 70%)," +
              "radial-gradient(closest-side, rgba(90,200,230,0.20), transparent 70%)",
            backgroundSize: "58% 42%, 44% 34%",
            backgroundPosition: "12% 22%, 74% 58%",
            backgroundRepeat: "no-repeat",
            filter: "blur(38px)",
            animation: "sk-caustic-a 19s ease-in-out infinite",
          }}
        />
        <div
          className="absolute inset-[-25%]"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(139,61,245,0.22), transparent 70%)," +
              "radial-gradient(closest-side, rgba(61,90,255,0.22), transparent 70%)",
            backgroundSize: "50% 38%, 62% 46%",
            backgroundPosition: "82% 14%, 24% 78%",
            backgroundRepeat: "no-repeat",
            filter: "blur(46px)",
            animation: "sk-caustic-b 26s ease-in-out infinite",
          }}
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 75% at 50% 42%, transparent 38%, rgba(3,10,16,0.74) 100%)",
        }}
      />

      <div className="relative flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="flex min-h-0 flex-1 flex-col justify-center">
        {/* ── Title ────────────────────────────────────────────────── */}
        <div className="relative shrink-0 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(61,90,255,0.55) 0%, transparent 68%)",
              filter: "blur(26px)",
              animation: `sk-flare 900ms ease-out ${T_LINE1 - 0.1}s both`,
            }}
          />
          <p
            className="stamp relative leading-[1.02] text-white"
            style={{
              fontSize: TITLE_SIZE,
              letterSpacing: "0.02em",
              animation: `sk-headline 760ms cubic-bezier(0.16, 1, 0.3, 1) ${T_LINE1}s both`,
            }}
          >
            THE POINTS
          </p>
          <p
            className="stamp relative leading-[1.02] text-white"
            style={{
              fontSize: TITLE_SIZE,
              letterSpacing: "0.02em",
              animation: `sk-headline 760ms cubic-bezier(0.16, 1, 0.3, 1) ${T_LINE2}s both`,
            }}
          >
            HAVE MOVED
          </p>
          <p
            className="relative mt-2 font-mono text-xs tracking-[0.2em] text-white/45"
            style={{ animation: `sk-rise 600ms ease-out ${T_DATE}s both` }}
          >
            {announcement.retroactive
              ? `FOR EVERY ${retroNoun(announcement).toUpperCase()}, BACK TO THE START`
              : `FROM ${formatDay(announcement.from).toUpperCase()}`}
          </p>
        </div>

        {/* ── What actually changed ────────────────────────────────── */}
        <div className="mt-8 shrink-0">
          <ul className="space-y-2.5">
            {announcement.moves.map((move, i) => {
              const ui = SPORT_UI[move.sport];
              const down = move.after < move.before;
              return (
                <li
                  key={`${move.sport}-${move.climb}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5"
                  style={{
                    animation: `sk-rise 620ms cubic-bezier(0.16, 1, 0.3, 1) ${
                      T_ROWS + i * T_ROW_STEP
                    }s both`,
                  }}
                >
                  <span className={`shrink-0 ${ui.text}`}>
                    <SportMark sport={move.sport} className="h-6 w-6" />
                  </span>
                  <span className="eyebrow min-w-0 flex-1 text-white">
                    {ui.label}
                    {move.climb && <span className="text-white/40"> climb</span>}
                  </span>
                  {/* Old rate struck through, new rate carried in the sport's own
                      colour — the change is the point, so both stay on screen. */}
                  <span className="shrink-0 font-mono text-sm text-white/35 line-through">
                    {rateText(move.before, move.sport, move.climb)}
                  </span>
                  <span aria-hidden className="shrink-0 text-white/25">
                    →
                  </span>
                  <span className={`shrink-0 font-mono text-base font-semibold ${ui.text}`}>
                    {rateText(move.after, move.sport, move.climb)}
                  </span>
                  <span className="sr-only">
                    {down ? "down from" : "up from"} {move.before}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        </div>

        {/* ── The reassurance, and the way out ─────────────────────── */}
        <div
          className="shrink-0"
          style={{ animation: `sk-rise 640ms ease-out ${outro}s both` }}
        >
          <p className="text-center text-[0.9375rem] leading-relaxed text-white/60">
            {announcement.retroactive ? (
              // Ryan, 2026-10-10: "fix cycling to 33 ... and all past data". The
              // usual line below would be untrue about this one, so say what
              // actually happened.
              <>
                This one counts backwards.{" "}
                <span className="font-semibold text-white/85">Every {retroNoun(announcement)}{" "}
                you&apos;ve ever logged</span>{" "}
                has been rescored at the new rate, all the way back to the start.
              </>
            ) : (
              <>
                Everything you&apos;ve already logged keeps the points it earned. Only
                sessions from{" "}
                <span className="font-semibold text-white/85">
                  {formatDay(announcement.from)}
                </span>{" "}
                onward score at the new rates.
              </>
            )}
          </p>
          <button
            onClick={onDismiss}
            autoFocus
            className="accent-fill eyebrow mt-4 w-full rounded-xl px-4 py-4 shadow-lg"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
