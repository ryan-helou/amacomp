"use client";

import { useEffect, useState } from "react";
import { SPORT_ORDER, fmtPoints } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import type { Sport } from "@/lib/types";

const R = 52;
const C = 2 * Math.PI * R;
// Round trig/geometry to dodge an SSR hydration mismatch (Node vs browser last-bit trig).
const round = (v: number) => Number(v.toFixed(2));
// Angle (deg) of a point `pos` length-units clockwise from the top of the ring.
const degAt = (pos: number) => round(-90 + (pos / C) * 360);

// The hatched paint marking admin-granted points on the ring — deliberately not
// a sport hue, so a glance reads it as "awarded, not earned".
const GRANT_HATCH = "url(#grantHatch)";
const GRANT_TIP = "#8a93a6";

/**
 * The weekly quota as a single ring whose arc is stacked from each discipline's
 * points, in that sport's colour — so at a glance you see how far along you are
 * *and* what got you there. Points the admin awarded directly are stacked last
 * as a hatched slate segment, so they never masquerade as earned work. The whole
 * ring fills green the moment quota is met.
 */
export function PaceClock({
  bySport,
  granted = 0,
  goal,
  size = 200,
  animate = true,
}: {
  bySport?: Partial<Record<Sport, number>>;
  /** Points awarded by the admin this week — shown as a distinct hatched slice. */
  granted?: number;
  goal: number;
  size?: number;
  animate?: boolean;
}) {
  const earned = SPORT_ORDER.reduce((sum, s) => sum + (bySport?.[s] ?? 0), 0);
  const points = earned + granted;
  const done = goal > 0 && points >= goal;
  const remaining = Math.max(goal - points, 0);

  // Lay each discipline's slice end-to-end, clockwise from the top, then the
  // granted slice last. Capped at a full lap; the sum never overshoots the ring.
  const segments: { key: string; paint: string; grant: boolean; start: number; len: number }[] = [];
  if (goal > 0 && !done) {
    let cursor = 0;
    for (const s of SPORT_ORDER) {
      const p = bySport?.[s] ?? 0;
      if (p <= 0) continue;
      const len = Math.min((p / goal) * C, C - cursor);
      if (len <= 0.01) continue;
      segments.push({ key: s, paint: SPORT_UI[s].hex, grant: false, start: cursor, len });
      cursor += len;
      if (cursor >= C - 0.01) break;
    }
    if (granted > 0 && cursor < C - 0.01) {
      const len = Math.min((granted / goal) * C, C - cursor);
      if (len > 0.01) {
        segments.push({ key: "granted", paint: GRANT_HATCH, grant: true, start: cursor, len });
        cursor += len;
      }
    }
  }

  const filled = segments.reduce((sum, seg) => sum + seg.len, 0);
  const tipRad = (degAt(filled) * Math.PI) / 180;
  const tipX = round(60 + R * Math.cos(tipRad));
  const tipY = round(60 + R * Math.sin(tipRad));
  const lastSeg = segments[segments.length - 1];
  const tipColor = lastSeg ? (lastSeg.grant ? GRANT_TIP : lastSeg.paint) : "";
  const showTip = points > 0 && !done;

  // Reveal the ring once mounted — the score in the centre never moves.
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
      <svg
        viewBox="0 0 120 120"
        className="h-full w-full transition-[opacity,transform] duration-700 ease-out"
        style={{
          opacity: shown ? 1 : 0,
          transform: shown ? "scale(1)" : "scale(0.9)",
          transformOrigin: "center",
        }}
      >
        <defs>
          {/* Fine diagonal hatch for the granted slice. */}
          <pattern
            id="grantHatch"
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="5" height="5" fill="var(--color-line)" />
            <line x1="0" y1="0" x2="0" y2="5" stroke={GRANT_TIP} strokeWidth="2.5" />
          </pattern>
        </defs>

        {/* Track */}
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-line)" strokeWidth="12" opacity="0.5" />

        {done ? (
          // Quota met — one clean green lap.
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="var(--color-good)"
            strokeWidth="12"
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--color-good) 45%, transparent))" }}
          />
        ) : (
          segments.map((seg) => (
            <circle
              key={seg.key}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={seg.paint}
              strokeWidth="12"
              strokeDasharray={`${round(seg.len)} ${round(C - seg.len)}`}
              transform={`rotate(${degAt(seg.start)} 60 60)`}
            />
          ))
        )}

        {/* Leading-edge marker at the tip of the arc */}
        {showTip && (
          <circle cx={tipX} cy={tipY} r="6" fill="var(--color-tile)" stroke={tipColor} strokeWidth="3" />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="stat leading-none text-ink" style={{ fontSize: size * 0.4 }}>
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
