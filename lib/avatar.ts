import type { Athlete } from "./types";

/**
 * A distinct colour per athlete so the board reads at a glance. Derived from a
 * stable hash of the id (no storage), chosen to sit apart from the sport hues.
 */
const PALETTE = [
  "#3d5aff", // blue
  "#e0398a", // magenta
  "#0f9d8f", // teal
  "#d9761a", // amber
  "#7b3fe4", // violet
  "#2aa5d6", // sky
  "#c2384a", // crimson
  "#4b7a2e", // olive
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function athleteColor(athlete: Pick<Athlete, "id">): string {
  return PALETTE[hash(athlete.id) % PALETTE.length];
}
