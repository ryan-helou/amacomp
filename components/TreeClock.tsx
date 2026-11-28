"use client";

import { useEffect, useState } from "react";
import { fmtPoints } from "@/lib/scoring";
import { RingStar } from "./FestiveScenes";

/**
 * The week's quota as a snow globe, for Season 3's Christmas weeks. Ryan,
 * 2026-11-28, picking from two rounds of mockups: "lets do snow globe i love
 * it and make ornament string lights also go up with the snow globe".
 *
 * The globe fills from the bottom in the colours of the sports that earned
 * the points, in the order they were earned (the same slices as the lap). A
 * string of 20 lights spirals up the little tree inside, and each bulb — 5
 * points — lights as the globe fills past it, in that stretch's sport colour.
 * At the quota the globe is full, the star on the tree blazes and the glass
 * sparkles.
 *
 * Same props as before; only the picture changed.
 */

export type TreeSlice = { key: string; tip: string; grant: boolean; start: number; len: number };

const round = (v: number) => Number(v.toFixed(2));

// The globe: a circle on a base. Everything inside is clipped to the glass.
const CX = 60;
const CY = 56;
const R = 44;
// The base covers the bottom of the glass, so the liquid is measured from the
// base's edge up to the top of the globe — points never fill out of sight.
const FLOOR = 94;
const BOTTOM = CY + R;
const SPAN = FLOOR - (CY - R); // a full globe is the quota

// The tree inside: four scalloped tiers, light from the left, snow on the tips.
const T_TOP = 26;
const T_BOT = 90;
const T_HW = 27;
const TIERS = 4;
const tiers = Array.from({ length: TIERS }, (_, i) => {
  const H = T_BOT - T_TOP;
  const t0 = T_TOP + H * (i / TIERS) * 0.82;
  const t1 = T_TOP + H * ((i + 1) / TIERS);
  const w = T_HW * (0.38 + (0.62 * (i + 1)) / TIERS);
  const k = 5 + i;
  const scallop: string[] = [];
  for (let j = k; j >= 0; j--) {
    const x = CX - w + (2 * w * j) / k;
    scallop.push(`${round(x)} ${round(t1 + (j % 2 ? 2.2 : 0))}`);
  }
  return {
    body: `M${CX} ${round(t0)} L${round(CX + w)} ${round(t1)} L${scallop.join(" L")} Z`,
    snow: `M${CX} ${round(t0)} L${round(CX + w * 0.36)} ${round(t0 + (t1 - t0) * 0.36)} Q${CX} ${round(
      t0 + (t1 - t0) * 0.26,
    )} ${round(CX - w * 0.36)} ${round(t0 + (t1 - t0) * 0.36)} Z`,
  };
});

// The string of lights: a spiral, bottom to top, 3¼ turns. Bulbs behind the
// tree are smaller and dimmer so it reads as wrapped round, not drawn on.
const BULBS = 20;
const TURNS = 3.25;
function spiral(f: number): { x: number; y: number; z: number } {
  const y = T_BOT - 3 - f * (T_BOT - T_TOP - 8);
  const w = T_HW * (0.14 + 0.86 * (1 - f)) * 0.9;
  const a = f * TURNS * 2 * Math.PI;
  return { x: round(CX + Math.sin(a) * w), y: round(y + Math.cos(a) * 2.4), z: Math.cos(a) };
}
const WIRE = Array.from({ length: 161 }, (_, i) => spiral(i / 160));
const wire = (front: boolean) =>
  WIRE.slice(1)
    .map((p, i) => ({ a: WIRE[i], b: p }))
    .filter(({ a }) => (a.z > 0) === front)
    .map(({ a, b }) => `M${a.x} ${a.y}L${b.x} ${b.y}`)
    .join("");
const WIRE_BACK = wire(false);
const WIRE_FRONT = wire(true);
const LIGHTS = Array.from({ length: BULBS }, (_, i) => ({ i, f: (i + 1) / BULBS, ...spiral((i + 0.5) / BULBS) }));

// Snow inside the glass: fixed positions, so every render draws the same storm.
const FLAKES = Array.from({ length: 24 }, (_, i) => ({
  x: round(CX - R + 6 + ((i * 37) % (SPAN - 12))),
  y: round(CY - R + 4 + ((i * 53) % (SPAN - 8))),
  r: i % 3 ? 0.8 : 1.3,
  d: 5 + ((i * 7) % 6),
  delay: -((i * 13) % 9),
}));

const SPARKLES: [number, number][] = [[20, 20], [100, 26], [98, 84], [22, 82]];
const RELAY_MS = 900;

function sliceAt(parts: TreeSlice[], f: number): TreeSlice | null {
  for (const p of parts) if (f <= p.start + p.len + 1e-6) return p;
  return parts[parts.length - 1] ?? null;
}

function Sparkle({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d={`M0 ${-r} L${r * 0.28} ${-r * 0.28} L${r} 0 L${r * 0.28} ${r * 0.28} L0 ${r} L${-r * 0.28} ${r * 0.28} L${-r} 0 L${-r * 0.28} ${-r * 0.28} Z`}
      fill="#fff6c8"
      className="xmas-bulb"
    />
  );
}

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

  // A met quota is a full globe, whatever order it was earned in.
  const layers = done
    ? parts.length
      ? parts.map((p, i, a) => (i === a.length - 1 ? { ...p, len: 1 - p.start } : p))
      : [{ key: "done", tip: "var(--color-good)", grant: false, start: 0, len: 1 }]
    : parts;
  const filled = Math.min(1, layers.reduce((s, p) => s + p.len, 0));
  const level = FLOOR - filled * SPAN;
  const glass = `${hatch}-glass`;
  const h = size * (126 / 120);

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative"
        style={{ width: size, height: h }}
        role="img"
        aria-label={`${fmtPoints(points)} of ${fmtPoints(goal)} points this week${
          excused > 0 ? `, ${fmtPoints(excused)} from an excused week` : ""
        }`}
      >
        {/* The star on the little tree, with its easter egg. */}
        <RingStar className="top-[17%]" size="h-6 w-6" bubble="-top-7" lit={done} />
        <svg viewBox="0 0 120 126" className="h-full w-full overflow-visible">
          <defs>
            <clipPath id={glass}>
              <circle cx={CX} cy={CY} r={R} />
            </clipPath>
            <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="rgb(255 255 255 / 0.15)" />
              <line x1="0" y1="0" x2="0" y2="5" stroke={grantTip} strokeWidth="2.5" />
            </pattern>
            <linearGradient id={`${hatch}-pine`} x1="0" x2="1">
              <stop offset="0" stopColor="#2fa463" />
              <stop offset="0.55" stopColor="#1e7c47" />
              <stop offset="1" stopColor="#11502c" />
            </linearGradient>
            <radialGradient id={`${hatch}-inside`} cx="0.4" cy="0.35" r="0.8">
              <stop offset="0" stopColor="#173a29" />
              <stop offset="1" stopColor="#0a1c13" />
            </radialGradient>
            <linearGradient id={`${hatch}-base`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#9a3527" />
              <stop offset="1" stopColor="#5a1a12" />
            </linearGradient>
            <filter id={`${hatch}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
          </defs>

          {/* The glass, from inside. */}
          <circle cx={CX} cy={CY} r={R} fill={`url(#${hatch}-inside)`} />

          <g clipPath={`url(#${glass})`}>
            {/* A little drift of snow on the floor — under the liquid, so it never hides the first points. */}
            <path d={`M${CX - R} ${FLOOR - 4} Q${CX - 20} ${FLOOR - 8} ${CX} ${FLOOR - 6} T${CX + R} ${FLOOR - 5} L${CX + R} ${BOTTOM} L${CX - R} ${BOTTOM} Z`} fill="#eef6f1" opacity="0.5" />
            {/* The liquid: one layer per sport, rising together on load. */}
            <g
              style={{
                transform: shown ? "translateY(0)" : `translateY(${round(filled * SPAN)}px)`,
                transition: animate ? `transform ${RELAY_MS}ms cubic-bezier(0.3, 0, 0.2, 1)` : undefined,
              }}
            >
              {layers.map((p) => (
                <rect
                  key={p.key}
                  x={CX - R}
                  y={round(FLOOR - (p.start + p.len) * SPAN)}
                  width={2 * R}
                  height={round(p.len * SPAN + 0.6 + (p.start === 0 ? BOTTOM - FLOOR : 0))}
                  fill={p.grant ? `url(#${hatch})` : p.tip}
                  opacity="0.62"
                />
              ))}
              {filled > 0 && filled < 1 && (
                <path
                  className="xmas-wave"
                  d={`M${CX - R - 20} ${round(level)} q5 -2 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0`}
                  fill="none"
                  stroke="#fff"
                  strokeOpacity="0.55"
                  strokeWidth="1"
                />
              )}
            </g>

            {/* The tree, its wire, and the far side of its lights. */}
            <rect x={CX - 4} y={T_BOT - 2} width="8" height="9" rx="1" fill="#6b4423" />
            <path d={WIRE_BACK} stroke="#0a2213" strokeWidth="0.7" opacity="0.5" fill="none" />
            {LIGHTS.filter((b) => b.z <= 0).map((b) => (
              <Bulb key={b.i} b={b} parts={parts} filled={filled} shown={shown} animate={animate} glow={`${hatch}-glow`} />
            ))}
            {tiers.map((t, i) => (
              <g key={i}>
                <path d={t.body} fill={`url(#${hatch}-pine)`} stroke="#0c2a19" strokeWidth="0.5" />
                <path d={t.snow} fill="#fff" opacity="0.8" />
              </g>
            ))}
            <path d={WIRE_FRONT} stroke="#0a2213" strokeWidth="0.8" fill="none" />
            {LIGHTS.filter((b) => b.z > 0).map((b) => (
              <Bulb key={b.i} b={b} parts={parts} filled={filled} shown={shown} animate={animate} glow={`${hatch}-glow`} />
            ))}

            {/* Snow, drifting down inside the glass. */}
            {FLAKES.map((f, i) => (
              <circle
                key={i}
                cx={f.x}
                cy={f.y}
                r={f.r}
                fill="#fff"
                opacity="0.85"
                className="xmas-globe-snow"
                style={{ animationDuration: `${f.d}s`, animationDelay: `${f.delay}s` }}
              />
            ))}
          </g>

          {/* The glass, from outside: rim and a curved glint. */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#dff1e7" strokeOpacity="0.55" strokeWidth="1.2" />
          <path
            d={`M${CX - 31} ${CY - 26} A${R - 5} ${R - 5} 0 0 1 ${CX + 2} ${CY - R + 5}`}
            stroke="#fff"
            strokeOpacity="0.4"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />

          {/* The base. */}
          <path d="M22 98 Q60 92 98 98 L104 114 Q60 120 16 114 Z" fill={`url(#${hatch}-base)`} stroke="#3e110b" strokeWidth="0.6" />
          <path d="M24 104 Q60 99 96 104" stroke="#f2c94c" strokeWidth="1.2" fill="none" />
          <path d="M19 110 Q60 115 101 110" stroke="#f2c94c" strokeOpacity="0.5" strokeWidth="0.6" fill="none" />

          {done && SPARKLES.map(([x, y], i) => <Sparkle key={i} x={x} y={y} r={3.6} />)}
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

/** One bulb on the string: lit once the globe has filled past its 5 points. */
function Bulb({
  b,
  parts,
  filled,
  shown,
  animate,
  glow,
}: {
  b: { i: number; f: number; x: number; y: number; z: number };
  parts: TreeSlice[];
  filled: number;
  shown: boolean;
  animate: boolean;
  glow: string;
}) {
  const lit = shown && filled >= b.f - 1e-6;
  const slice = lit ? sliceAt(parts, b.f - 0.5 / BULBS) : null;
  const colour = slice ? (slice.grant ? "#c9ced6" : slice.tip) : "var(--color-good)";
  const front = b.z > 0;
  const r = front ? 2.2 : 1.5;
  return (
    <g
      opacity={front ? 1 : 0.6}
      style={{ transition: animate ? `opacity 200ms ease-out ${Math.round(b.f * RELAY_MS)}ms` : undefined }}
    >
      {lit && <circle cx={b.x} cy={b.y + 1.8} r={r * 2.3} fill={colour} opacity={front ? 0.5 : 0.25} filter={`url(#${glow})`} />}
      <ellipse
        cx={b.x}
        cy={b.y + 1.8}
        rx={r}
        ry={r * 1.25}
        fill={lit ? colour : "#2a4a36"}
        stroke={lit ? "#fff" : "#456b55"}
        strokeWidth="0.35"
        className={lit ? "xmas-bulb" : undefined}
        style={{ animationDelay: `${(b.i % 7) * 0.31}s` }}
      />
    </g>
  );
}
