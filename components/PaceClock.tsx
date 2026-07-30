"use client";

import { fmtPoints } from "@/lib/scoring";

const R = 52;
const C = 2 * Math.PI * R;
// Round trig to dodge an SSR hydration mismatch (Node vs browser last-bit trig).
const round = (v: number) => Number(v.toFixed(2));

/**
 * The weekly quota as a single clean progress ring — a bold gradient sweep on a
 * soft track, a dot riding the leading edge, and the score dead-centre. Fills
 * green the moment the quota is met.
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
  const remaining = Math.max(goal - points, 0);
  const stroke = done ? "var(--color-good)" : "url(#quota-sweep)";

  // Dot at the tip of the sweep (hidden at 0 and once the ring is full).
  const tipAngle = 2 * Math.PI * capped;
  const tipX = round(60 + R * Math.cos(tipAngle));
  const tipY = round(60 + R * Math.sin(tipAngle));
  const showDot = points > 0 && !done;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${fmtPoints(points)} of ${fmtPoints(goal)} points this week`}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="quota-sweep" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="var(--color-accent-2)" />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth="11"
          opacity="0.5"
        />

        {/* Sweep — a soft glow underneath for depth, then the crisp arc on top */}
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - capped)}
          opacity="0.35"
          style={{ filter: "blur(5px)" }}
        />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="11"
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

        {/* Leading-edge dot */}
        {showDot && (
          <circle
            cx={tipX}
            cy={tipY}
            r="6"
            fill="var(--color-tile)"
            stroke="url(#quota-sweep)"
            strokeWidth="3"
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="stamp leading-none text-ink" style={{ fontSize: size * 0.3 }}>
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
