import type { CSSProperties } from "react";
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
  /**
   * Flags that are a symbol on a white field rather than three stripes. These
   * paint their own opaque field, so they also pin the lane's ink — see
   * `flagInk`.
   */
  emblem?: "sun" | "leaf";
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
 * The maple leaf from the flag's own construction sheet — eleven points, curved
 * shoulders, a 3.3-wide stem.
 *
 * Draw it in `MAPLE_BOX`, which is the path's measured bounding box rather than
 * the construction sheet's square: the ink runs from y -72 to -3, so a taller
 * box leaves dead space under the stem and anything centring the box hangs the
 * leaf visibly high.
 *
 * Hand-drawn polygons were tried twice and both read as a starburst at any size
 * under about 60px: the real leaf's silhouette is carried by the deep narrow
 * notches and the uneven point lengths, not by eleven evenly spaced spikes.
 * Rendered side by side, this was the only one recognisable in a 22×14 tag.
 */
export const MAPLE =
  "m 0,-72 -5.5,10.3 c -0.6,1.2 -1.8,1.1 -3,0.4 l -4,-2.1 3,15.9 c 0.6,2.9 -1.4,2.9 -2.4,1.6 " +
  "l -7,-7.8 -1.1,4 c -0.1,0.5 -0.7,1.1 -1.6,0.9 l -8.8,-1.9 2.3,8.4 c 0.5,1.9 0.9,2.6 -0.5,3.1 " +
  "l -3.1,1.5 15,12.2 c 0.6,0.5 0.9,1.3 0.7,2.1 l -1.3,4.3 14.6,-1.7 c 0.4,0 0.9,0.4 0.9,1 " +
  "l -0.5,16.6 h 3.3 l -0.3,-16.6 c 0,-0.6 0.4,-1 0.9,-1 l 14.6,1.7 -1.3,-4.3 c -0.2,-0.8 0.1,-1.6 0.7,-2.1 " +
  "l 15,-12.2 -3.1,-1.5 c -1.4,-0.5 -1,-1.2 -0.5,-3.1 l 2.3,-8.4 -8.8,1.9 c -0.9,0.2 -1.5,-0.4 -1.6,-0.9 " +
  "l -1.1,-4 -7,7.8 c -1,1.3 -3,1.3 -2.4,-1.6 l 3,-15.9 -4,2.1 c -1.2,0.7 -2.4,0.8 -3,-0.4 z";

/** The measured bounds of `MAPLE`, so the drawn leaf sits centred in its box. */
export const MAPLE_BOX = "-32.2 -72.5 63.4 69.8";

export const JAPAN: Flag = { label: "Japan", from: "#BC002D", mid: "#FFFFFF", to: "#BC002D", emblem: "sun" };
export const CANADA: Flag = { label: "Canada", from: "#D52B1E", mid: "#FFFFFF", to: "#D52B1E", emblem: "leaf" };

/**
 * Trips that fly a flag WITHOUT an excuse — the athlete is still training and
 * still owes the quota; this is decoration only. Matched by exact name (Jona
 * and Jonah are two different people). Inclusive dates.
 */
export const TRIPS: { name: string; from: DayKey; to: DayKey; flag: Flag }[] = [
  { name: "Ryan", from: "2026-09-11", to: "2026-09-17", flag: JAPAN },
  { name: "Alberto", from: "2026-09-12", to: "2026-09-13", flag: CANADA },
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
 * Ink for text drawn over a flag's lane. A sun flag paints a white field, so
 * under a dark colourway (Carbon's ink is near-white) the score and name would
 * vanish. Re-pointing the ink tokens on the lane keeps every `text-ink*` child
 * dark there, whatever the scheme. Tricolours are a translucent wash over the
 * deck and keep the scheme's own ink.
 */
export function flagInk(flag: Flag): CSSProperties {
  if (!flag.emblem) return {};
  return {
    "--ink": "#0b1f2d",
    "--ink-2": "#3f5f74",
    "--ink-3": "#63808f",
    "--line": "rgb(13 34 49 / 0.16)",
    // The accent pair too: Soot and Void accent with white, and a white quota
    // bar on the flag's white field is an empty bar.
    "--accent": "#0b1f2d",
    "--accent-2": "#3f5f74",
  } as CSSProperties;
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
  backgroundPosition?: string;
} {
  if (flag.emblem === "leaf") {
    // Canada: a red band down each edge and a white field, in the flag's own
    // 1:2:1 proportions.
    //
    // The leaf has to be BOLD to survive: the lane is 76px tall with a
    // full-width bar and the name across it, so a faint one merges into a blob.
    // It is drawn nearly the lane's full height at the same strength as Japan's
    // sun, with broad lobes and a short stem.
    const c = flag.from;
    const leaf =
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${MAPLE_BOX}'>` +
      `<path fill='${c}' fill-opacity='0.55' d='${MAPLE}'/></svg>`;
    return {
      backgroundImage:
        `url("data:image/svg+xml,${encodeURIComponent(leaf)}"),` +
        // Feathered rather than hard-edged, for the same reason the tricolour
        // wash is: a crisp block behind a leaderboard row reads as a rendering
        // fault, a soft one reads as lit.
        ` linear-gradient(90deg, ${c}7A 0 6%, ${c}4D 12%, ${c}00 19%, ${c}00 81%,` +
        ` ${c}4D 88%, ${c}7A 94%),` +
        ` linear-gradient(${flag.mid}E0, ${flag.mid}E0)`,
      // Sized to FIT the lane, not fill it: at full height the points are
      // clipped top and bottom and what is left reads as a starburst.
      backgroundSize: "auto 76%, 100% 100%, 100% 100%",
      backgroundRepeat: "no-repeat, no-repeat, no-repeat",
      backgroundPosition: "center, 0 0, 0 0",
    };
  }
  if (flag.emblem === "sun") {
    // The actual flag: a white field and a crisp crimson sun dead centre,
    // about 3/5 of the lane's height. Held under half strength because the
    // name and bar run across it. Faint seigaiha waves fill the field so it
    // reads as cloth, not a blank row.
    const c = flag.from;
    return {
      backgroundImage:
        `radial-gradient(circle closest-side at 50% 50%, ${c}80 0 64%, ${c}00 66%),` +
        // A white disc under the red one blanks the waves, so the sun sits
        // cleanly on top of the pattern instead of letting it show through.
        ` radial-gradient(circle closest-side at 50% 50%, ${flag.mid} 0 64%, ${flag.mid}00 66%),` +
        ` radial-gradient(circle at 50% 100%, transparent 0 3px, ${c}24 3px 4px,` +
        ` transparent 4px 7px, ${c}24 7px 8px, transparent 8px 11px, ${c}24 11px 12px, transparent 12px),` +
        ` linear-gradient(${flag.mid}E0, ${flag.mid}E0)`,
      backgroundSize: "100% 100%, 100% 100%, 24px 12px, 100% 100%",
      backgroundRepeat: "no-repeat, no-repeat, repeat, no-repeat",
    };
  }
  return {
    backgroundImage:
      `linear-gradient(100deg, ${flag.from}80 0%, ${flag.from}5C 30%,` +
      ` ${flag.mid}00 47%, ${flag.mid}00 53%,` +
      ` ${flag.to}5C 70%, ${flag.to}80 100%)`,
  };
}
