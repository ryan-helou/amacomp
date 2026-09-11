"use client";

import { useEffect, useId, useState } from "react";
import { SPORT_ORDER, fmtPoints } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import type { Sport } from "@/lib/types";

const GRANT_TIP = "#8a93a6";
// Round trig to dodge an SSR hydration mismatch (Node vs browser last-bit trig).
const round = (v: number) => Number(v.toFixed(2));

// A stadium track: bends of radius R centred at (60,50) and (60,70), joined by
// two 20-unit straights. One lap starts at the finish line, top centre.
const R = 40;
const BEND = 20 * Math.PI; // a quarter bend at R = 40
const LAP = 4 * BEND + 40;
const RELAY_MS = 900;
const track = (r: number) =>
  `M60 ${50 - r}A${r} ${r} 0 0 1 ${60 + r} 50L${60 + r} 70` +
  `A${r} ${r} 0 0 1 ${60 - r} 70L${60 - r} 50A${r} ${r} 0 0 1 60 ${50 - r}`;

/** The point `f` of the way round the lap, on the centre of the track. */
function pointAt(f: number): [number, number] {
  let d = f * LAP;
  const onBend = (cy: number, from: number, dist: number): [number, number] => {
    const a = from + dist / R;
    return [round(60 + R * Math.cos(a)), round(cy + R * Math.sin(a))];
  };
  if (d <= BEND) return onBend(50, -Math.PI / 2, d);
  d -= BEND;
  if (d <= 20) return [100, round(50 + d)];
  d -= 20;
  if (d <= 2 * BEND) return onBend(70, 0, d);
  d -= 2 * BEND;
  if (d <= 20) return [20, round(70 - d)];
  d -= 20;
  return onBend(50, Math.PI, d);
}

type Slice = { key: string; tip: string; grant: boolean; start: number; len: number };

/** Each discipline's share of the quota end to end, then the granted share, as fractions of one lap. */
function slices(bySport: Partial<Record<Sport, number>> | undefined, granted: number, goal: number): Slice[] {
  const out: Slice[] = [];
  let cursor = 0;
  for (const s of SPORT_ORDER) {
    const p = bySport?.[s] ?? 0;
    const len = Math.min(p / goal, 1 - cursor);
    if (p <= 0 || len <= 0.0001) continue;
    out.push({ key: s, tip: SPORT_UI[s].hex, grant: false, start: cursor, len });
    cursor += len;
  }
  const len = Math.min(granted / goal, 1 - cursor);
  if (granted > 0 && len > 0.0001) out.push({ key: "granted", tip: GRANT_TIP, grant: true, start: cursor, len });
  return out;
}

/**
 * The weekly quota as one lap of a running track. Each discipline runs its leg
 * in its own colour, handing over to the next like a relay; granted points run
 * the last leg hatched. Lane lines sit on top of the colour so it reads as a
 * track, the finish line is at the top, and the whole lap goes green when quota
 * is met.
 */
export function PaceClock({
  bySport,
  granted = 0,
  goal,
  size = 200,
  animate = true,
}: {
  bySport?: Partial<Record<Sport, number>>;
  /** Points awarded by the admin this week — a hatched leg, not a sport colour. */
  granted?: number;
  goal: number;
  size?: number;
  animate?: boolean;
}) {
  const hatch = `hatch-${useId().replace(/:/g, "")}`;
  const earned = SPORT_ORDER.reduce((sum, s) => sum + (bySport?.[s] ?? 0), 0);
  const points = earned + granted;
  const done = goal > 0 && points >= goal;
  const remaining = Math.max(goal - points, 0);
  const parts = goal > 0 && !done ? slices(bySport, granted, goal) : [];
  const filled = parts.reduce((sum, p) => sum + p.len, 0);
  const tip = parts[parts.length - 1]?.tip ?? "";
  const [tx, ty] = pointAt(filled);

  // Run the relay once mounted — the score in the infield never moves.
  const [shown, setShown] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const t = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(t);
  }, [animate]);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${fmtPoints(points)} of ${fmtPoints(goal)} points this week${
        granted > 0 ? `, ${fmtPoints(granted)} awarded by admin` : ""
      }`}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full">
        <defs>
          <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="var(--color-line)" />
            <line x1="0" y1="0" x2="0" y2="5" stroke={GRANT_TIP} strokeWidth="2.5" />
          </pattern>
        </defs>

        {/* Infield */}
        <path d={track(33)} fill="var(--color-good)" opacity="0.07" />
        {/* Track */}
        <path d={track(R)} fill="none" stroke="var(--color-line)" strokeWidth="12" opacity="0.5" />

        {done ? (
          <path
            d={track(R)}
            fill="none"
            stroke="var(--color-good)"
            strokeWidth="12"
            style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--color-good) 45%, transparent))" }}
          />
        ) : (
          parts.map((p) => (
            <path
              key={p.key}
              d={track(R)}
              pathLength={100}
              fill="none"
              stroke={p.grant ? `url(#${hatch})` : p.tip}
              strokeWidth="12"
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

        {/* Lane lines, over the colour so it reads as a track. */}
        {[38, 42].map((r) => (
          <path key={r} d={track(r)} fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.75" />
        ))}

        {/* Finish line */}
        {Array.from({ length: 16 }, (_, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          return (
            <rect
              key={i}
              x={58.5 + col * 1.5}
              y={4 + row * 1.5}
              width="1.5"
              height="1.5"
              fill={(row + col) % 2 ? "#fff" : "var(--color-ink)"}
              opacity="0.85"
            />
          );
        })}

        {/* The runner: where you are on the lap. */}
        {points > 0 && !done && (
          <circle
            cx={tx}
            cy={ty}
            r="5"
            fill="var(--color-tile)"
            stroke={tip}
            strokeWidth="2.5"
            opacity={shown ? 1 : 0}
            style={{ transition: `opacity 220ms ease-out ${animate ? Math.round(filled * RELAY_MS) : 0}ms` }}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="stat leading-none text-ink" style={{ fontSize: size * 0.36 }}>
          {fmtPoints(points)}
        </div>
        <div
          className={`eyebrow mt-2 ${done ? "text-good" : "text-ink-3"}`}
          style={{ fontSize: Math.max(9, size * 0.05) }}
        >
          {done ? "Quota met" : `${fmtPoints(remaining)} to go`}
        </div>
      </div>
    </div>
  );
}
