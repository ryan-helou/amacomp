"use client";

import { useEffect, useState } from "react";
import { fmtPoints } from "@/lib/scoring";
import { RingStar } from "./FestiveScenes";

/**
 * The week's quota as a Christmas tree, for Season 3's Christmas weeks (Ryan,
 * 2026-11-27: "make the track a christmas tree for season 3"). The lap becomes
 * a garland winding up from the bottom branches to the star; each discipline
 * runs its stretch in its own colour, exactly as on the track; the baubles
 * light as the garland reaches them; and when the quota is met the whole
 * garland turns candy cane and the star blazes.
 *
 * Same props and the same slices as PaceClock — only the shape changes.
 */

export type TreeSlice = { key: string; tip: string; grant: boolean; start: number; len: number };

// The garland, bottom left to the star, zig-zagging across the tiers.
const G: [number, number][] = [
  [22, 103], [98, 96], [30, 81], [86, 74], [38, 58], [82, 51], [46, 38], [74, 31], [54, 21], [60, 15],
];
const SEGS = G.slice(1).map((p, i) => Math.hypot(p[0] - G[i][0], p[1] - G[i][1]));
const TOTAL = SEGS.reduce((a, b) => a + b, 0);
const GARLAND = "M" + G.map(([x, y]) => `${x} ${y}`).join(" L");
const round = (v: number) => Number(v.toFixed(2));

function garlandAt(f: number): [number, number] {
  let d = Math.max(0, Math.min(1, f)) * TOTAL;
  for (let i = 0; i < SEGS.length; i++) {
    if (d <= SEGS[i] || i === SEGS.length - 1) {
      const t = SEGS[i] ? Math.min(1, d / SEGS[i]) : 0;
      return [round(G[i][0] + (G[i + 1][0] - G[i][0]) * t), round(G[i][1] + (G[i + 1][1] - G[i][1]) * t)];
    }
    d -= SEGS[i];
  }
  return G[G.length - 1];
}

const TREE =
  "M60 6 L82 36 L72 36 L94 64 L82 64 L108 108 L12 108 L38 64 L26 64 L48 36 L38 36 Z";
const BAUBLES = [0.06, 0.16, 0.25, 0.35, 0.45, 0.55, 0.64, 0.74, 0.84, 0.93];
const BAUBLE_C = ["#d42a35", "#f2c94c", "#6fc3ff", "#e23a44", "#f2c94c", "#d42a35", "#6fc3ff", "#f2c94c", "#e23a44", "#6fc3ff"];
const RELAY_MS = 900;

export function TreeClock({
  parts,
  done,
  points,
  remaining,
  goal,
  excused,
  size,
  animate,
  hatch,
  grantTip,
}: {
  parts: TreeSlice[];
  done: boolean;
  points: number;
  remaining: number;
  goal: number;
  excused: number;
  size: number;
  animate: boolean;
  hatch: string;
  grantTip: string;
}) {
  const [shown, setShown] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const t = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(t);
  }, [animate]);

  const filled = done ? 1 : parts.reduce((s, p) => s + p.len, 0);
  const tip = parts[parts.length - 1]?.tip ?? "";
  const [tx, ty] = garlandAt(filled);
  const w = size;
  const h = size * (122 / 120);

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative"
        style={{ width: w, height: h }}
        role="img"
        aria-label={`${fmtPoints(points)} of ${fmtPoints(goal)} points this week${
          excused > 0 ? `, ${fmtPoints(excused)} from an excused week` : ""
        }`}
      >
        <RingStar className="top-[-6px]" lit={done} />
        <svg viewBox="0 0 120 122" className="h-full w-full">
          <defs>
            <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="var(--color-line)" />
              <line x1="0" y1="0" x2="0" y2="5" stroke={grantTip} strokeWidth="2.5" />
            </pattern>
            <linearGradient id={`${hatch}-pine`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#2a9a58" />
              <stop offset="1" stopColor="#14532f" />
            </linearGradient>
          </defs>

          {/* Trunk, tree, and snow on the tips of the branches. */}
          <rect x="53" y="107" width="14" height="12" rx="1.5" fill="#6b4423" />
          <path d={TREE} fill={`url(#${hatch}-pine)`} />
          <path d="M60 6 L66 14 Q60 12 54 14 Z M82 36 L72 36 L76 33 Z M38 36 L48 36 L44 33 Z M94 64 L82 64 L88 60 Z M26 64 L38 64 L32 60 Z" fill="#fff" opacity="0.75" />

          {/* The garland's whole route, faint, so you can see how far is left. */}
          <path d={GARLAND} fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 4" />

          {done ? (
            <g style={{ filter: "drop-shadow(0 0 3px rgb(226 58 68 / 0.6))" }}>
              <path d={GARLAND} fill="none" stroke="#fbf7f2" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d={GARLAND} pathLength={100} fill="none" stroke="#d42a35" strokeWidth="3.4" strokeDasharray="1.4 1.4" strokeLinejoin="round" />
            </g>
          ) : (
            parts.map((p) => (
              <path
                key={p.key}
                d={GARLAND}
                pathLength={100}
                fill="none"
                stroke={p.grant ? `url(#${hatch})` : p.tip}
                strokeWidth="3.4"
                strokeLinejoin="round"
                strokeDasharray={shown ? `${round(p.len * 100)} ${round(100 - p.len * 100)}` : "0 100"}
                strokeDashoffset={round(-p.start * 100)}
                style={{
                  transition: animate
                    ? `stroke-dasharray ${Math.round(Math.max(150, p.len * RELAY_MS))}ms linear ${Math.round(p.start * RELAY_MS)}ms`
                    : undefined,
                }}
              />
            ))
          )}

          {/* Baubles light as the garland reaches them. */}
          {BAUBLES.map((f, i) => {
            const [x, y] = garlandAt(f);
            const lit = shown && filled >= f;
            return (
              <circle
                key={f}
                cx={x}
                cy={y + 3.2}
                r="2.6"
                fill={lit ? BAUBLE_C[i] : "#0d3b22"}
                stroke={lit ? "#fff" : "#2f6b47"}
                strokeWidth="0.6"
                className={lit ? "xmas-bulb" : undefined}
                style={{
                  animationDelay: `${i * 0.3}s`,
                  transition: animate ? `fill 200ms ease-out ${Math.round(f * RELAY_MS)}ms` : undefined,
                }}
              />
            );
          })}

          {/* Where you are on the garland. */}
          {points > 0 && !done && (
            <circle
              cx={tx}
              cy={ty}
              r="3.4"
              fill={tip}
              stroke="#fff"
              strokeWidth="1.2"
              opacity={shown ? 1 : 0}
              style={{ transition: `opacity 220ms ease-out ${animate ? Math.round(filled * RELAY_MS) : 0}ms` }}
            />
          )}
        </svg>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="stat leading-none text-ink" style={{ fontSize: Math.max(28, size * 0.2) }}>
          {fmtPoints(points)}
        </span>
        <span className={`eyebrow ${done ? "text-good" : "text-ink-3"}`}>
          {done ? "Quota met" : `${fmtPoints(remaining)} to go`}
        </span>
      </div>
    </div>
  );
}
