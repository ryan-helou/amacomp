"use client";

import { useEffect } from "react";
import { athleteColor } from "@/lib/avatar";
import type { Athlete } from "@/lib/types";
import type { SeasonInfo } from "@/lib/season";
import { Avatar } from "./Avatar";

/**
 * The season kickoff card — the one screen where the app goes dark.
 *
 * A season start is a race start: everyone is back to zero, in their own lane.
 * So rather than a generic reveal, the athletes are *announced onto the blocks*
 * — each one rides in along a lane rope tinted their own colour, the same
 * colour that marks their sessions in the feed. Deliberately no confetti: that
 * already means "someone hit quota", and reusing it here would cost both
 * moments their meaning.
 */
export function SeasonKickoff({
  season,
  athletes,
  meId,
  onDismiss,
}: {
  season: SeasonInfo;
  athletes: Athlete[];
  meId: string | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  // Lanes are announced in board order, but a long roster has to stay on one
  // screen — past six the rows tighten rather than scroll.
  const tight = athletes.length > 6;
  const LANE_START = 1.6; // seconds — after the whole title has settled
  const LANE_STAGGER = 0.13;
  const rosterSetAt = LANE_START + athletes.length * LANE_STAGGER + 0.05;
  const outroAt = rosterSetAt + 0.35;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${season.label} kickoff`}
      className="fixed inset-0 z-[60] overflow-hidden text-white"
      style={{
        // Deep pool-deck ink — the app's own colour taken down for the night.
        backgroundColor: "#081722",
        animation: "sk-veil 420ms ease-out both",
      }}
    >
      {/* Pool light from above, and caustics moving underneath it — the surface
          of the water lit from the deck. Three slabs on different periods so the
          pattern never repeats itself the same way. */}
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
            "radial-gradient(120% 75% at 50% 45%, transparent 40%, rgba(3,10,16,0.72) 100%)",
        }}
      />

      {/* One pass of light once the roster is set — the flash at the start line. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.16) 45%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.16) 55%, transparent)",
          filter: "blur(6px)",
          animation: `sk-sweep 1100ms cubic-bezier(0.4, 0, 0.2, 1) ${rosterSetAt}s both`,
        }}
      />

      <div className="relative flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        {/* ── Title card ─────────────────────────────────────────── */}
        <div className="relative shrink-0 pt-6 text-center">
          {/* The flare fires once, timed to the number landing. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(176,131,7,0.75) 0%, transparent 68%)",
              filter: "blur(26px)",
              animation: "sk-flare 900ms ease-out both",
            }}
          />
          <p
            className="eyebrow relative text-[0.6875rem]"
            style={{ color: "#e2b53d", animation: "sk-eyebrow 700ms ease-out both" }}
          >
            Season
          </p>
          {/* The gold sits on its own layer so it always rests bright; the
              specular band is a second, mostly-transparent copy swept across
              on top. Sweeping the base gradient itself would leave the numeral
              parked on whatever stop the animation happened to end on. */}
          <div
            className="stat relative mt-1 leading-[0.82]"
            style={{
              fontSize: "clamp(5.5rem, 30vw, 9.5rem)",
              filter: "drop-shadow(0 6px 30px rgba(226,181,61,0.45))",
              animation: "sk-slam 760ms cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
          >
            <span
              style={{
                backgroundImage: "linear-gradient(168deg, #ffeaa4 0%, #e2b53d 42%, #a67a05 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {season.number}
            </span>
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.92) 50%, transparent 60%)",
                backgroundSize: "260% 100%",
                backgroundPosition: "190% 0",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                animation: "sk-sheen 1500ms cubic-bezier(0.3, 0, 0.2, 1) 640ms both",
              }}
            >
              {season.number}
            </span>
          </div>
          {/* Reads top-to-bottom as one sentence — SEASON / 1 / STARTS NOW —
              with the numeral carrying the weight. */}
          <p
            className="stamp relative mt-2 text-white"
            style={{
              fontSize: "clamp(1.75rem, 8.5vw, 2.6rem)",
              letterSpacing: "0.02em",
              animation: "sk-headline 760ms cubic-bezier(0.16, 1, 0.3, 1) 700ms both",
            }}
          >
            STARTS NOW
          </p>
          <p
            className="relative mt-2.5 font-mono text-xs tracking-[0.2em] text-white/45"
            style={{ animation: "sk-rise 600ms ease-out 900ms both" }}
          >
            {season.monthsLabel.replace("–", " – ").toUpperCase()}
          </p>
        </div>

        {/* ── The blocks ─────────────────────────────────────────── */}
        {/* Centred in the leftover space so a short roster reads as composed
            rather than leaving a dead gap above the stakes. */}
        <div className="mt-7 flex min-h-0 flex-1 flex-col justify-center">
          <p
            className="eyebrow text-[0.625rem] text-white/35"
            style={{ animation: `sk-rise 500ms ease-out ${LANE_START - 0.2}s both` }}
          >
            On the blocks
          </p>
          <ul className={tight ? "mt-2.5 space-y-2" : "mt-3.5 space-y-3.5"}>
            {athletes.map((a, i) => {
              const color = a.avatarColor ?? athleteColor(a);
              const delay = LANE_START + i * LANE_STAGGER;
              const isMe = a.id === meId;
              return (
                <li key={a.id}>
                  {/* The rope strings out first, then the athlete arrives on it. */}
                  <div
                    aria-hidden
                    className="sk-rope"
                    style={
                      {
                        "--rope": color,
                        animation: `sk-rope 520ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}s both`,
                      } as React.CSSProperties
                    }
                  />
                  <div
                    className="mt-2 flex items-center gap-3"
                    style={{
                      animation: `sk-enter-lane 560ms cubic-bezier(0.16, 1, 0.3, 1) ${
                        delay + 0.12
                      }s both`,
                    }}
                  >
                    {/* The splash they make landing in the lane — one ring in
                        their own colour, expanding out and gone. */}
                    <span
                      className="relative flex shrink-0 items-center justify-center rounded-full"
                      style={{ boxShadow: `0 0 22px -4px ${color}` }}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-full"
                        style={{
                          border: `2px solid ${color}`,
                          animation: `sk-splash 900ms cubic-bezier(0.16, 1, 0.3, 1) ${
                            delay + 0.18
                          }s both`,
                        }}
                      />
                      <Avatar
                        athlete={a}
                        className={
                          tight
                            ? "h-9 w-9 text-[0.625rem]"
                            : "h-11 w-11 text-[0.6875rem]"
                        }
                      />
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate font-semibold ${
                        tight ? "text-sm" : "text-[0.9375rem]"
                      }`}
                      style={{ letterSpacing: "0.01em" }}
                    >
                      {a.name}
                      {isMe && (
                        <span className="ml-2 text-xs font-normal text-white/40">you</span>
                      )}
                    </span>
                    {/* Everyone starts level — the whole point of a season
                        opening. Legible enough to read as a score, quiet
                        enough not to compete with the name. */}
                    <span
                      aria-hidden
                      className="stat shrink-0 text-base text-white/30"
                      style={{ letterSpacing: "0.06em" }}
                    >
                      0
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Stakes + way in ────────────────────────────────────── */}
        <div
          className="shrink-0 pt-5"
          style={{ animation: `sk-rise 640ms ease-out ${outroAt}s both` }}
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
  );
}
