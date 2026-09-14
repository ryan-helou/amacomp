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
//
// The track is drawn once, at full width, and stays visible all the way round.
// Your points run as a narrower line INSIDE it, in lane one, rather than
// repainting the whole band — a band that fills over its own lane lines stops
// looking like a track and becomes a fat ring.
//
// Every measurement below is derived from R and BAND, never typed in. The first
// version hard-coded the lane centre, the lane lines and the finish line
// separately, each close to right, and on a phone the small misses showed: your
// line hugged the infield instead of sitting in its lane, and the finish line
// stopped short of the track with a sliver of colour peeking out under it.
const R = 40;
const BAND = 13; // the width of the track itself
const INNER = R - BAND / 2; // the track's inside edge
const OUTER = R + BAND / 2; // and its outside edge
const LANE_WIDTH = BAND / 3; // three equal lanes
const LINES = [INNER + LANE_WIDTH, INNER + 2 * LANE_WIDTH]; // the two lane lines
const LINE_W = 0.5; // how thick those lane lines are drawn
// The kerb and the outside edge are drawn as white lines too, like a real track.
// Without the kerb the dark infield and the dark track ran together, so the gap
// on the inside of your line vanished and the line looked like it was hugging
// the infield even when it was exactly centred.
const EDGES = [INNER, OUTER];
// Lane one as you SEE it: between the inside of the kerb and the inside of the
// first lane line — half of each line's thickness eats into the lane.
const LANE_SEEN_IN = INNER + LINE_W / 2;
const LANE_SEEN_OUT = LINES[0] - LINE_W / 2;
const LANE = (LANE_SEEN_IN + LANE_SEEN_OUT) / 2; // the middle of lane one
const GUTTER = 0.55; // clear track either side of your line
const LANE_W = LANE_SEEN_OUT - LANE_SEEN_IN - 2 * GUTTER; // your line
const FINISH_ROWS = 8; // chequers down the finish line, filling the band exactly
const CHEQUER = BAND / FINISH_ROWS;
const RELAY_MS = 900;
const track = (r: number) =>
  `M60 ${50 - r}A${r} ${r} 0 0 1 ${60 + r} 50L${60 + r} 70` +
  `A${r} ${r} 0 0 1 ${60 - r} 70L${60 - r} 50A${r} ${r} 0 0 1 60 ${50 - r}`;

/** The point `f` of the way round a lap of radius `r`. */
function pointAt(f: number, r: number): [number, number] {
  const bend = (Math.PI / 2) * r; // a quarter bend
  let d = f * (4 * bend + 40);
  const onBend = (cy: number, from: number, dist: number): [number, number] => {
    const a = from + dist / r;
    return [round(60 + r * Math.cos(a)), round(cy + r * Math.sin(a))];
  };
  if (d <= bend) return onBend(50, -Math.PI / 2, d);
  d -= bend;
  if (d <= 20) return [100, round(50 + d)];
  d -= 20;
  if (d <= 2 * bend) return onBend(70, 0, d);
  d -= 2 * bend;
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
    out.push({ key: s, tip: SPORT_UI[s].paint, grant: false, start: cursor, len });
    cursor += len;
  }
  const len = Math.min(granted / goal, 1 - cursor);
  if (granted > 0 && len > 0.0001) out.push({ key: "granted", tip: GRANT_TIP, grant: true, start: cursor, len });
  return out;
}

/**
 * The weekly quota as one lap of a running track. Each discipline runs its leg
 * in its own colour, handing over to the next like a relay; granted points run
 * the last leg hatched. The track and its lane lines stay visible the whole way
 * round; your points run as a line in lane one inside it, so the ring reads as
 * a runner on a track rather than a band filling up. Lane one goes green when
 * quota is met.
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
  const [tx, ty] = pointAt(filled, LANE);
  // A long score ("105.1") is wider than the infield at the usual size.
  const label = fmtPoints(points);
  const statSize = size * Math.max(0.2, 0.36 - 0.05 * Math.max(0, label.length - 3));

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
        {/* Filled right up to the track's edge, so no dark seam shows between them. */}
        <path d={track(INNER)} fill="var(--color-good)" opacity="0.07" />
        {/* The track, and its lane lines — both stay visible all the way round. */}
        <path d={track(R)} fill="none" stroke="var(--color-line)" strokeWidth={BAND} opacity="0.5" />
        {[...EDGES, ...LINES].map((r) => (
          <path key={r} d={track(r)} fill="none" stroke="#fff" strokeWidth={LINE_W} opacity="0.55" />
        ))}

        {/* Your lap, run in lane one. */}
        {done ? (
          <path
            d={track(LANE)}
            fill="none"
            stroke="var(--color-good)"
            strokeWidth={LANE_W}
            style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--color-good) 45%, transparent))" }}
          />
        ) : (
          parts.map((p) => (
            <path
              key={p.key}
              d={track(LANE)}
              pathLength={100}
              fill="none"
              stroke={p.grant ? `url(#${hatch})` : p.tip}
              strokeWidth={LANE_W}
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

        {/* Finish line */}
        {/* Two columns centred on the start, spanning the band edge to edge, so
            it covers the first sliver of your line rather than stopping short. */}
        {Array.from({ length: FINISH_ROWS * 2 }, (_, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          return (
            <rect
              key={i}
              x={round(60 - CHEQUER + col * CHEQUER)}
              y={round(50 - OUTER + row * CHEQUER)}
              width={round(CHEQUER)}
              height={round(CHEQUER)}
              // Ink against deck, not against white: on a dark scheme the ink
              // IS near-white, and a white-on-white chequer is no chequer.
              fill={(row + col) % 2 ? "var(--color-deck)" : "var(--color-ink)"}
              opacity="0.85"
            />
          );
        })}

        {/* The runner: where you are on the lap. A plain solid grey dot, no
            outline — the line carries the sport colours, the dot just marks
            the spot. */}
        {points > 0 && !done && (
          <circle
            cx={tx}
            cy={ty}
            r="3.6"
            fill="var(--color-ink-3)"
            opacity={shown ? 1 : 0}
            style={{ transition: `opacity 220ms ease-out ${animate ? Math.round(filled * RELAY_MS) : 0}ms` }}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="stat leading-none text-ink" style={{ fontSize: statSize }}>
          {label}
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
