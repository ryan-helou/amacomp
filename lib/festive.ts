import type { DayKey } from "./dates";

/**
 * The Christmas look. Ryan, 2026-11-27: Christmas-themed UI for Season 3,
 * "Dec 7 – Jan 6" — kickoff through the twelve days of Christmas, then the
 * normal look for the rest of the season. Colours, snow, Santa hats on every
 * figure, a candy-cane lap, string-of-lights lane ropes, a gift on "Met", a
 * festive kickoff card.
 *
 * Purely a look: nothing here touches scoring.
 */
export const CHRISTMAS = { from: "2026-12-07", to: "2027-01-06" } as const;

export function isChristmas(day: DayKey | string): boolean {
  return day >= CHRISTMAS.from && day <= CHRISTMAS.to;
}

/**
 * The preview switch, kept in the browser so the admin can see the look before
 * Dec 7. "on" forces it, "off" hides it, anything else follows the date.
 */
export const FESTIVE_KEY = "amacomp-festive";

export function festiveFor(day: DayKey | string, preview: string | null): boolean {
  if (preview === "on") return true;
  if (preview === "off") return false;
  return isChristmas(day);
}

/** Every figure wears this while it's Christmas. */
export const SANTA_HAT = "head.santa";

const dayNo = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86_400_000);

/** "The 3rd day of Christmas" from Dec 25 (1st) to Jan 5 (12th); null otherwise. */
export function dayOfChristmas(day: string): number | null {
  const y = Number(day.slice(0, 4));
  const start = day.slice(5) >= "12-25" ? `${y}-12-25` : `${y - 1}-12-25`;
  const n = dayNo(day) - dayNo(start) + 1;
  return n >= 1 && n <= 12 ? n : null;
}

export const isChristmasDay = (day: string) => day.slice(5) === "12-25";
export const isEpiphany = (day: string) => day.slice(5) === "01-06";
