import type { Activity } from "./types";
import { isExcuse } from "./types";
import { inRange, periodRange, type DayKey } from "./dates";

/**
 * Who is away this week, and what flag to fly for them.
 *
 * Derived from the excuse itself rather than a separate list: an excused week is
 * already a row in the log, so "away" needs no new storage and no second place
 * to keep in sync. The excuse's note names the country, which is also what makes
 * this general — the next person in Spain writes "Spain" and gets a Spanish one.
 */

export interface Flag {
  /** What to show a reader, and what screen readers say. */
  label: string;
  /** Left and right of the sweep. Both dark enough to read as text on the deck —
   *  the white band is the moving sheen on top, not a colour stop here. */
  from: string;
  to: string;
  /** The middle band of the actual flag, for the little striped tag. Kept out of
   *  the text gradient on purpose: white text on a pale deck is no text. */
  mid: string;
}

/**
 * Country keyword to flag. Deliberately a small explicit table rather than a
 * lookup of every nation: this exists because someone went to Italy, and an
 * unrecognised note simply gets no colours rather than a guess.
 */
const FLAGS: { match: RegExp; flag: Flag }[] = [
  { match: /\bital(y|ia|ian)\b/i, flag: { label: "Italy", from: "#008C45", mid: "#F4F5F0", to: "#CD212A" } },
  { match: /\bspain|espa(n|ñ)a\b/i, flag: { label: "Spain", from: "#AA151B", mid: "#F1BF00", to: "#AA151B" } },
  { match: /\bfrance|français\b/i, flag: { label: "France", from: "#0055A4", mid: "#FFFFFF", to: "#EF4135" } },
  { match: /\bportugal\b/i, flag: { label: "Portugal", from: "#046A38", mid: "#FFE900", to: "#DA291C" } },
  { match: /\bgreece\b/i, flag: { label: "Greece", from: "#0D5EAF", mid: "#FFFFFF", to: "#0D5EAF" } },
];

export function flagFor(note: string | null): Flag | null {
  if (!note) return null;
  for (const { match, flag } of FLAGS) if (match.test(note)) return flag;
  return null;
}

/**
 * Athletes excused during the week containing `refDay`, mapped to their flag.
 *
 * Only athletes whose excuse names a country we have colours for appear — an
 * excuse with no note is still an excuse, it just doesn't get a paint job.
 */
export function awayThisWeek(activities: Activity[], refDay: DayKey): Map<string, Flag> {
  const week = periodRange("week", refDay);
  const out = new Map<string, Flag>();
  for (const a of activities) {
    if (!isExcuse(a)) continue;
    if (!inRange(a.occurredOn, week)) continue;
    const flag = flagFor(a.note);
    if (flag) out.set(a.athleteId, flag);
  }
  return out;
}
