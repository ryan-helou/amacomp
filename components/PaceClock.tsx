"use client";

import { fmtPoints } from "@/lib/scoring";

const R = 52;
const C = 2 * Math.PI * R;

/**
 * The pace clock on every pool deck: a ticked dial with one sweeping hand. Here
 * the sweep is the week's points against the quota. It fills past a full lap
 * when someone overshoots, which is the point — the ring keeps going.
 */
export function PaceClock({
  points,
  goal,
  size = 200,
  animate = true,
}: {
  points: number;
  goal: number;
  size?: number;
  animate?: boolean;
}) {
  const progress = goal > 0 ? points / goal : 0;
  const capped = Math.min(progress, 1);
  const done = progress >= 1;
  const overflow = Math.min(Math.max(progress - 1, 0), 1);
  const remaining = Math.max(goal - points, 0);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${fmtPoints(points)} of ${fmtPoints(goal)} points this week`}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth="9"
        />

        {/* Quota sweep */}
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={done ? "var(--color-good)" : "var(--color-ink)"}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - capped)}
          style={
            animate
              ? ({
                  ["--sweep-empty" as string]: `${C}`,
                  animation: "sweep-in 900ms cubic-bezier(0.22, 1, 0.36, 1)",
                } as React.CSSProperties)
              : undefined
          }
        />

        {/* A second lap, drawn thin, for whoever blows past the quota */}
        {overflow > 0 && (
          <circle
            cx="60"
            cy="60"
            r={R - 9}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * (R - 9)}
            strokeDashoffset={2 * Math.PI * (R - 9) * (1 - overflow)}
          />
        )}

        {/* Dial ticks, twelve like a real pace clock */}
        <g stroke="var(--color-ink-3)" strokeWidth="2" strokeLinecap="round">
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const r1 = R - 15;
            const r2 = i % 3 === 0 ? R - 21 : R - 18;
            return (
              <line
                key={i}
                x1={60 + Math.cos(a) * r1}
                y1={60 + Math.sin(a) * r1}
                x2={60 + Math.cos(a) * r2}
                y2={60 + Math.sin(a) * r2}
              />
            );
          })}
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="stamp text-ink"
          style={{ fontSize: size * 0.26 }}
        >
          {fmtPoints(points)}
        </div>
        <div
          className="eyebrow mt-1 text-ink-2"
          style={{ fontSize: Math.max(9, size * 0.055) }}
        >
          {done ? "Quota met" : `${fmtPoints(remaining)} to go`}
        </div>
      </div>
    </div>
  );
}
