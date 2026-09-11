import type { Sport } from "./types";

/**
 * Tailwind scans source for literal class names, so sport styling is written out
 * per sport rather than built from a template string.
 *
 * `paint` is the variable, not a hex: a colourway may re-point the four sport
 * colours (Soot and Void do), and anything drawn in SVG has to follow the
 * scheme the same way the `text-*` and `bg-*` classes already do. Use it
 * wherever a literal colour is needed; never append alpha to it.
 */
export const SPORT_UI: Record<
  Sport,
  { label: string; text: string; bg: string; border: string; soft: string; paint: string }
> = {
  swim: {
    label: "Swim",
    text: "text-swim",
    bg: "bg-swim",
    border: "border-swim",
    soft: "bg-swim/10",
    paint: "var(--color-swim)",
  },
  bike: {
    label: "Bike",
    text: "text-bike",
    bg: "bg-bike",
    border: "border-bike",
    soft: "bg-bike/10",
    paint: "var(--color-bike)",
  },
  run: {
    label: "Run",
    text: "text-run",
    bg: "bg-run",
    border: "border-run",
    soft: "bg-run/10",
    paint: "var(--color-run)",
  },
  gym: {
    label: "Gym",
    text: "text-gym",
    bg: "bg-gym",
    border: "border-gym",
    soft: "bg-gym/10",
    paint: "var(--color-gym)",
  },
};

/**
 * Hatched slate fill that marks admin-awarded points everywhere they surface —
 * the ring slice, the weekly bars, the feed. Deliberately not a sport hue, so a
 * glance reads it as "awarded, not earned". Use as a CSS `background-image`.
 */
export const GRANT_HATCH =
  "repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-ink-2) 60%, transparent) 0 2px, color-mix(in srgb, var(--color-ink-2) 14%, transparent) 2px 5px)";

/** Initials for the lane avatar — one letter for a single name, two otherwise. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
