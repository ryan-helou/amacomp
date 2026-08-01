"use client";

import { useEffect } from "react";
import type { SeasonInfo } from "@/lib/season";

/**
 * The season kickoff card — the one screen where the app goes dark.
 *
 * A title card, not a roster: SEASON / n / STARTS NOW, and then the lads get
 * slapped on like a die-cut sticker, hard enough to knock the whole card
 * sideways. Deliberately no confetti — that already means "someone hit quota",
 * and reusing it would cost both moments their meaning.
 */

// Beat sheet, in seconds.
const T_LINE1 = 0.25;
const T_LINE2 = 0.62;
const T_MONTHS = 0.98;
const T_SLAP = 1.3;
const T_OUTRO = 2.2;

// Both title lines share one size so they read as a single stacked lockup.
const TITLE_SIZE = "clamp(1.9rem, 9.5vw, 2.9rem)";

export function SeasonKickoff({
  season,
  onDismiss,
}: {
  season: SeasonInfo;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${season.label} starts now`}
      className="fixed inset-0 z-[60] overflow-hidden text-white"
      style={{
        // Deep pool-deck ink — the app's own colour taken down for the night.
        backgroundColor: "#081722",
        animation: "sk-veil 420ms ease-out both",
      }}
    >
      {/* Pool light from above, and caustics moving underneath it. Three slabs
          on different periods so the pattern never repeats the same way. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(115% 55% at 50% -10%, rgba(61,90,255,0.30) 0%, transparent 55%)," +
            "radial-gradient(90% 45% at 50% 108%, rgba(176,131,7,0.20) 0%, transparent 60%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-[-25%]"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(61,140,220,0.30), transparent 70%)," +
              "radial-gradient(closest-side, rgba(90,200,230,0.22), transparent 70%)",
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
              "radial-gradient(closest-side, rgba(139,61,245,0.24), transparent 70%)," +
              "radial-gradient(closest-side, rgba(61,90,255,0.22), transparent 70%)",
            backgroundSize: "50% 38%, 62% 46%",
            backgroundPosition: "82% 14%, 24% 78%",
            backgroundRepeat: "no-repeat",
            filter: "blur(46px)",
            animation: "sk-caustic-b 26s ease-in-out infinite",
          }}
        />
        <div
          className="absolute inset-[-25%]"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(226,181,61,0.20), transparent 70%)",
            backgroundSize: "54% 40%",
            backgroundPosition: "50% 8%",
            backgroundRepeat: "no-repeat",
            filter: "blur(52px)",
            animation: "sk-caustic-c 33s ease-in-out infinite",
          }}
        />
      </div>

      {/* Cinematic framing — pulls the eye to the middle of the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 75% at 50% 42%, transparent 38%, rgba(3,10,16,0.74) 100%)",
        }}
      />

      {/* One pass of light, riding out on the impact. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.16) 45%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0.16) 55%, transparent)",
          filter: "blur(6px)",
          animation: `sk-sweep 1000ms cubic-bezier(0.4, 0, 0.2, 1) ${T_SLAP + 0.1}s both`,
        }}
      />

      {/* Everything inside takes the hit when the sticker lands. */}
      <div
        className="relative h-full"
        style={{ animation: `sk-jolt 520ms ease-out ${T_SLAP + 0.28}s both` }}
      >
        <div className="flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
          {/* ── Title ──────────────────────────────────────────────── */}
          <div className="relative shrink-0 pt-4 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(176,131,7,0.75) 0%, transparent 68%)",
                filter: "blur(26px)",
                animation: `sk-flare 900ms ease-out ${T_LINE1 - 0.1}s both`,
              }}
            />
            {/* Two lines, one size — SEASON n / STARTS NOW reads as a single
                stacked lockup. The numeral keeps the gold so the season still
                carries the accent, and a specular band sweeps the line once.
                The gold sits on its own layer and the sheen is a second,
                mostly-transparent copy on top: sweeping the base gradient
                itself parks the text on whatever stop the animation ends on. */}
            <div
              className="stamp relative leading-[1.02] text-white"
              style={{
                fontSize: TITLE_SIZE,
                letterSpacing: "0.02em",
                animation: `sk-headline 760ms cubic-bezier(0.16, 1, 0.3, 1) ${T_LINE1}s both`,
              }}
            >
              <span>SEASON </span>
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
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.85) 50%, transparent 58%)",
                  backgroundSize: "260% 100%",
                  backgroundPosition: "190% 0",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  animation: `sk-sheen 1400ms cubic-bezier(0.3, 0, 0.2, 1) ${
                    T_LINE1 + 0.35
                  }s both`,
                }}
              >
                SEASON {season.number}
              </span>
            </div>

            <p
              className="stamp relative leading-[1.02] text-white"
              style={{
                fontSize: TITLE_SIZE,
                letterSpacing: "0.02em",
                animation: `sk-headline 760ms cubic-bezier(0.16, 1, 0.3, 1) ${T_LINE2}s both`,
              }}
            >
              STARTS NOW
            </p>
            <p
              className="relative mt-2 font-mono text-xs tracking-[0.2em] text-white/45"
              style={{ animation: `sk-rise 600ms ease-out ${T_MONTHS}s both` }}
            >
              {season.monthsLabel.replace("–", " – ").toUpperCase()}
            </p>
          </div>

          {/* ── The lads ───────────────────────────────────────────── */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center py-3">
            {/* Shockwave off the impact. */}
            <div
              aria-hidden
              className="pointer-events-none absolute h-52 w-52 rounded-full"
              style={{
                border: "3px solid rgba(226,181,61,0.85)",
                animation: `sk-shock 850ms cubic-bezier(0.16, 1, 0.3, 1) ${
                  T_SLAP + 0.24
                }s both`,
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- static same-origin sticker, next/image adds nothing here */}
            <img
              src="/lads.webp"
              alt=""
              aria-hidden
              className="relative max-h-full w-auto object-contain"
              style={{
                // Stacked white shadows build the die-cut sticker edge; the last
                // one is the shadow it casts on the deck.
                filter:
                  "drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff)" +
                  " drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff)" +
                  " drop-shadow(0 14px 22px rgba(0,0,0,0.55))",
                animation: `sk-slap 780ms cubic-bezier(0.2, 1.2, 0.35, 1) ${T_SLAP}s both`,
              }}
            />
          </div>

          {/* ── Stakes + way in ────────────────────────────────────── */}
          <div
            className="shrink-0 pt-4"
            style={{ animation: `sk-rise 640ms ease-out ${T_OUTRO}s both` }}
          >
            <p className="text-center text-[0.9375rem] leading-relaxed text-white/60">
              Two months. Winner eats free and wears{" "}
              <span className="font-semibold" style={{ color: "#e2b53d" }}>
                gold
              </span>{" "}
              all next season. Last place cooks.
            </p>
            <button
              onClick={onDismiss}
              autoFocus
              className="accent-fill eyebrow mt-4 w-full rounded-xl px-4 py-4 shadow-lg"
            >
              Take your lane
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
