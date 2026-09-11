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
  /** A disc flag (Japan): drawn as a sun, not three stripes. */
  sun?: boolean;
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

export const JAPAN: Flag = { label: "Japan", from: "#BC002D", mid: "#FFFFFF", to: "#BC002D", sun: true };

/**
 * Trips that fly a flag WITHOUT an excuse — the athlete is still training and
 * still owes the quota; this is decoration only. Matched by exact name (Jona
 * and Jonah are two different people). Inclusive dates.
 */
export const TRIPS: { name: string; from: DayKey; to: DayKey; flag: Flag }[] = [
  { name: "Ryan", from: "2026-09-11", to: "2026-09-17", flag: JAPAN },
];

/**
 * Athletes away during the week containing `refDay`, mapped to their flag:
 * anyone excused with a note naming a country we have colours for, plus any
 * trip overlapping the week. An excuse with no note is still an excuse, it just
 * doesn't get a paint job.
 */
export function awayThisWeek(
  activities: Activity[],
  refDay: DayKey,
  athletes: { id: string; name: string }[] = [],
  trips = TRIPS,
): Map<string, Flag> {
  const week = periodRange("week", refDay);
  const out = new Map<string, Flag>();
  for (const a of activities) {
    if (!isExcuse(a)) continue;
    if (!inRange(a.occurredOn, week)) continue;
    const flag = flagFor(a.note);
    if (flag) out.set(a.athleteId, flag);
  }
  for (const t of trips) {
    if (t.to < week[0] || t.from > week[1]) continue;
    const who = athletes.find((a) => a.name === t.name);
    if (who && !out.has(who.id)) out.set(who.id, t.flag);
  }
  return out;
}

/**
 * The lane background for an away athlete. Tricolours get three feathered
 * bands; a flag with a sun gets a soft wash and a red disc rising at the right
 * edge, so it reads as Japan rather than as a red-white-red stripe.
 */
export function flagWash(flag: Flag): {
  backgroundImage: string;
  backgroundSize?: string;
  backgroundRepeat?: string;
} {
  if (flag.sun) {
    // The actual flag: a plain white field and a crisp crimson sun dead
    // centre, nearly the lane's full height. Held just under half strength
    // because the name and bar run across it.
    const c = flag.from;
    return {
      backgroundImage:
        `radial-gradient(circle closest-side at 50% 50%, ${c}80 0 86%, ${c}00 88%),` +
        ` linear-gradient(${flag.mid}EB, ${flag.mid}EB)`,
    };
  }
  return {
    backgroundImage:
      `linear-gradient(100deg, ${flag.from}80 0%, ${flag.from}5C 30%,` +
      ` ${flag.mid}00 47%, ${flag.mid}00 53%,` +
      ` ${flag.to}5C 70%, ${flag.to}80 100%)`,
  };
}
