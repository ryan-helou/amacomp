import type { Sport } from "./types";

/**
 * Tailwind scans source for literal class names, so sport styling is written out
 * per sport rather than built from a template string.
 */
export const SPORT_UI: Record<
  Sport,
  { label: string; text: string; bg: string; border: string; soft: string; hex: string }
> = {
  swim: {
    label: "Swim",
    text: "text-swim",
    bg: "bg-swim",
    border: "border-swim",
    soft: "bg-swim/10",
    hex: "#0d93bd",
  },
  bike: {
    label: "Bike",
    text: "text-bike",
    bg: "bg-bike",
    border: "border-bike",
    soft: "bg-bike/10",
    hex: "#d98217",
  },
  run: {
    label: "Run",
    text: "text-run",
    bg: "bg-run",
    border: "border-run",
    soft: "bg-run/10",
    hex: "#d93b30",
  },
  gym: {
    label: "Gym",
    text: "text-gym",
    bg: "bg-gym",
    border: "border-gym",
    soft: "bg-gym/10",
    hex: "#6d4fc4",
  },
};

/** Initials for the lane avatar — one letter for a single name, two otherwise. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
