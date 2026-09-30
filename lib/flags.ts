import { FLAG_ART } from "./flagArt";

/**
 * The flags you can fly beside your name.
 *
 * Drawn as a small tag, the way an away week's flag already is on the Board
 * (lib/away.ts, `FlagTag`) — Ryan's call, 2026-09-29: the hanging banners
 * behind the figure were too much, and this is the look the app already has.
 *
 * That away list is deliberately a different, tiny thing: it exists because
 * someone wrote "Italy" in an excuse note, and it only ever needs the handful
 * of countries the lads actually travel to. This is a shop shelf, so it carries
 * its own emblems and its own set.
 */

export interface CountryFlag {
  id: string;
  label: string;
  /** Two or three bands, hoist to fly (or top to bottom when `rows`). */
  bands: string[];
  /** Horizontal bands rather than vertical. */
  rows?: boolean;
  /** Relative band widths — Canada is 1:2:1, not thirds. */
  weights?: number[];
  /**
   * The drawing, in the 30x20 box a flag is drawn in.
   *
   * Every real flag takes this from FLAG_ART, which is generated from the
   * official files. Only the house flag sets it by hand, because there is no
   * AmaComp to copy.
   */
  art: string;
}

/**
 * Nine, chosen by Ryan on 2026-09-30, and no filler. The fifteen that went
 * were mostly plain tricolours, which as a LANE all read the same — a left
 * band, a pale middle and a red right — so you were paying four hundred coins
 * for a row somebody else already had. What is left either carries an emblem
 * or is a country somebody here is actually from.
 *
 * Each one is drawn to its real construction, not to an impression of it.
 */
export const COUNTRY_FLAGS: CountryFlag[] = [
  { id: "ca", label: "Canada", bands: ["#FF0000", "#FFFFFF", "#FF0000"], weights: [1, 2, 1], art: FLAG_ART.ca },
  { id: "qc", label: "Quebec", bands: ["#003DA5"], weights: [1], art: FLAG_ART.qc },
  { id: "lb", label: "Lebanon", bands: ["#D31624", "#FFFFFF", "#D31624"], rows: true, weights: [1, 2, 1], art: FLAG_ART.lb },
  { id: "it", label: "Italy", bands: ["#009246", "#FFFFFF", "#CE2B37"], art: FLAG_ART.it },
  { id: "jp", label: "Japan", bands: ["#FFFFFF"], weights: [1], art: FLAG_ART.jp },
  { id: "jo", label: "Jordan", bands: ["#000000", "#FFFFFF", "#007A3D"], rows: true, art: FLAG_ART.jo },
  { id: "br", label: "Brazil", bands: ["#009440"], weights: [1], art: FLAG_ART.br },
  { id: "ke", label: "Kenya", bands: ["#000000", "#FFFFFF", "#BB0000", "#FFFFFF", "#006600"], rows: true, weights: [6, 1, 6, 1, 6], art: FLAG_ART.ke },
  // The one flag with nothing to copy. Magenta, black and mint are the app's
  // own colours and the star is the only shape here anybody drew.
  {
    id: "ama", label: "AmaComp", bands: ["#D4147E", "#101215", "#16D39A"],
    art:
      `<rect width="10" height="20" fill="#D4147E"/><rect x="10" width="10" height="20" fill="#101215"/>` +
      `<rect x="20" width="10" height="20" fill="#16D39A"/>` +
      `<polygon fill="#C9A227" points="15,3.5 16.76,8.91 22.45,8.91 17.85,12.25 19.61,17.66 15,14.32 10.39,17.66 12.15,12.25 7.55,8.91 13.24,8.91"/>`,
  },
];


export const FLAG_BY_ID = new Map(COUNTRY_FLAGS.map((f) => [f.id, f]));

/** Several of the copied files use `xlink:href`, so every wrapper declares it. */
const XLINK = 'xmlns:xlink="http://www.w3.org/1999/xlink"';

/**
 * The flag itself, as SVG markup.
 *
 * ONE drawing serves both places it appears: the little tag beside a name and
 * the lane behind a whole row. Ryan's call, 2026-09-29 — a lane should be the
 * country's flag, not an impression of it, and two drawings of Canada would
 * disagree with each other by the end of the month.
 */
export function flagSvg(id: string): string {
  const flag = FLAG_BY_ID.get(id);
  if (!flag) return "";
  // preserveAspectRatio="none" on purpose: the app draws every flag at one
  // shape so a row of them lines up, and has since the away tags. Canada and
  // Jordan are 1:2 in life and are stretched here like everything else.
  // xlink must be declared even though the app is HTML: the same markup is
  // also embedded in a data: URI for the lane, and THAT is parsed as strict
  // XML, where an undeclared prefix throws out the whole image. Quebec,
  // Brazil and Kenya all use xlink:href, and all three silently vanished.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ${XLINK} viewBox="0 0 30 20" ` +
    `preserveAspectRatio="none">${flag.art}</svg>`
  );
}

/** How light a colour is, 0 (black) to 1 (white). */
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/**
 * The lane: the country's flag behind a whole row.
 *
 * The bands are a CSS gradient and the emblem is its own centred layer rather
 * than one SVG stretched across the row. Stretch a 3:2 flag to the shape of a
 * leaderboard row and Japan's sun becomes an ellipse and Canada's leaf goes
 * flat — bands are the only part of a flag that can take that.
 *
 * A scrim sits over the lot, strongest at the ends where the name and the
 * number are and lightest in the middle where the emblem is: you can read the
 * row and still see the flag.
 */
export function flagLane(id: string): {
  backgroundImage: string;
  backgroundSize: string;
  backgroundRepeat: string;
  backgroundPosition: string;
  "--ink"?: string;
  "--ink-2"?: string;
  "--ink-3"?: string;
} | null {
  const flag = FLAG_BY_ID.get(id);
  if (!flag) return null;

  const weights = flag.weights ?? [1, 1, 1];
  const total = weights.reduce((a, b) => a + b, 0);
  let at = 0;
  const stops = flag.bands.map((colour, i) => {
    const from = (at / total) * 100;
    at += weights[i] ?? 1;
    const to = (at / total) * 100;
    return `${colour} ${from.toFixed(2)}% ${to.toFixed(2)}%`;
  });
  const bands = `linear-gradient(${flag.rows ? 180 : 90}deg, ${stops.join(", ")})`;

  // The ink follows what's actually under the TEXT. On a horizontal flag that
  // is the MIDDLE band, since the text runs across the middle of the row —
  // averaging the three put light text on Jordan's white stripe. On a vertical
  // one it's the first band, where the name sits.
  const ends = flag.rows
    ? lum(flag.bands[Math.floor(flag.bands.length / 2)])
    : lum(flag.bands[0]);
  const light = ends > 0.5;
  const c = light ? "255,255,255" : "8,10,14";
  // The scrim used to be a symmetric wash, thinnest in the middle at 0.3 —
  // fine when the row was one short line of large type, wrong now the row
  // carries a figure, a name and a line of small mono across that middle.
  // So it is left-heavy: solid under everything that is read, thinning only
  // over the right third, which is the one part of the row with nothing in
  // it but the points, and those get their own patch at the end.
  const scrim =
    `linear-gradient(90deg, rgba(${c},0.90) 0%, rgba(${c},0.88) 56%,` +
    ` rgba(${c},0.46) 70%, rgba(${c},0.34) 84%, rgba(${c},0.78) 100%)`;

  // The flag itself, small, in the right third — at its true 3:2 shape, not
  // stretched like the tag, because this one is a badge sitting ON the wash
  // rather than filling it. The right third is the only stretch of a row with
  // nothing in it: put it centre and it sits behind the athlete's name. It
  // goes ON TOP of the scrim, not under it: a badge is the same colours as
  // the wash it lands on, so anything dimming it makes it disappear into its
  // own flag. The hairline is what separates the two.
  const badge = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" ${XLINK} viewBox="-0.75 -0.75 31.5 21.5">` +
      `${flag.art}<rect x="-0.375" y="-0.375" width="30.75" height="20.75" fill="none" ` +
      `stroke="rgba(0,0,0,0.55)" stroke-width="0.75"/></svg>`,
  );
  const layers = [`url("data:image/svg+xml,${badge}")`, scrim, bands];
  const sizes = ["auto 62%", "100% 100%", "100% 100%"];
  const spots = ["74% center", "0 0", "0 0"];

  return {
    backgroundImage: layers.join(", "),
    backgroundSize: sizes.join(", "),
    backgroundRepeat: layers.map(() => "no-repeat").join(", "),
    backgroundPosition: spots.join(", "),
    ...(light ? { "--ink": "#0b1f2d", "--ink-2": "#3f5f74", "--ink-3": "#4e6d80" } : {}),
  };
}
