import { MAPLE, MAPLE_BOX } from "./away";
import { FLAG_ART, FLEUR, FLEUR_BOX } from "./flagArt";

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
  /**
   * Where the flag's true-shape copy sits in the lane, as a fraction of the
   * row. `null` means it has no shape to save — Italy is three stripes, and a
   * stripe stretched is still a stripe.
   *
   * Default 0.76: the gap between the end of the detail line and the start of
   * the points.
   */
  laneAt?: number | null;
  /**
   * What to draw at that spot instead of the whole flag, in the same 30x20
   * box, for flags whose BANDS ARE VERTICAL.
   *
   * The lane paints its bands stretched, which is honest for a stripe. A
   * flag with horizontal bands looks identical stretched or not, so its whole
   * drawing can go on top and the seam cannot be seen. Canada's cannot: drop
   * the whole flag on and you get its red-white-red inside the stretched
   * red-white-red, at the wrong scale. So Canada contributes its leaf alone.
   */
  laneMotif?: string;
  /**
   * Which way the scrim leans, when the flag's own colours would decide
   * wrongly. A flag whose middle band is white gets a WHITE scrim, and a
   * white scrim at nine tenths turns the whole row into a light box — Jordan
   * and Lebanon both glared. Forcing the dark side keeps them in the deck.
   */
  laneInk?: "light" | "dark";
  /**
   * How much scrim, as a multiplier. Below 1 lets more of the flag through,
   * which is how a muted one is brightened: Italy's green and red were
   * sitting under nine tenths of darkness.
   */
  laneAlpha?: number;
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
/** The house flag's star, the one shape in this file anybody drew. */
const STAR =
  `<polygon fill="#C9A227" points="15,3.5 16.76,8.91 22.45,8.91 17.85,12.25 19.61,17.66 ` +
  `15,14.32 10.39,17.66 12.15,12.25 7.55,8.91 13.24,8.91"/>`;

export const COUNTRY_FLAGS: CountryFlag[] = [
  {
    id: "ca", label: "Canada", bands: ["#FF0000", "#FFFFFF", "#FF0000"], weights: [1, 2, 1], art: FLAG_ART.ca,
    // Centred, where the white band is widest, and as big as that band will
    // take: the leaf is the flag, so it gets the room.
    laneAt: 0.5,
    laneMotif: `<svg x="6.5" y="1" width="17" height="18" viewBox="${MAPLE_BOX}"><path fill="#FF0000" d="${MAPLE}"/></svg>`,
  },
  {
    id: "qc", label: "Quebec", bands: ["#003DA5"], weights: [1], art: FLAG_ART.qc,
    // The whole Fleurdelise shrunk to row height put four fleurs and a cross
    // into about twelve pixels, which is porridge. One fleur, big, on the
    // blue it already has — that reads as Quebec at a glance and the little
    // one does not.
    laneMotif: `<svg x="8.4" y="0.5" width="13.2" height="19" viewBox="${FLEUR_BOX}"><path fill="#FFFFFF" d="${FLEUR}"/></svg>`,
  },
  { id: "lb", label: "Lebanon", bands: ["#D31624", "#FFFFFF", "#D31624"], rows: true, weights: [1, 2, 1], art: FLAG_ART.lb, laneInk: "dark" },
  { id: "it", label: "Italy", bands: ["#009246", "#FFFFFF", "#CE2B37"], art: FLAG_ART.it, laneAt: null, laneAlpha: 0.62 },
  { id: "jp", label: "Japan", bands: ["#FFFFFF"], weights: [1], art: FLAG_ART.jp },
  // The chevron belongs at the hoist on a flag, but the hoist of a LANE is
  // under the rank, the figure and the name, with the scrim at its heaviest.
  // Put it where it can be seen; the bands are horizontal, so they line up
  // wherever the copy lands and only the chevron appears.
  { id: "jo", label: "Jordan", bands: ["#000000", "#FFFFFF", "#007A3D"], rows: true, art: FLAG_ART.jo, laneInk: "dark" },
  { id: "br", label: "Brazil", bands: ["#009440"], weights: [1], art: FLAG_ART.br },
  { id: "ke", label: "Kenya", bands: ["#000000", "#FFFFFF", "#BB0000", "#FFFFFF", "#006600"], rows: true, weights: [6, 1, 6, 1, 6], art: FLAG_ART.ke },
  // The one flag with nothing to copy. Magenta, black and mint are the app's
  // own colours and the star is the only shape here anybody drew.
  {
    id: "ama", label: "AmaComp", bands: ["#D4147E", "#101215", "#16D39A"],
    art:
      `<rect width="10" height="20" fill="#D4147E"/><rect x="10" width="10" height="20" fill="#101215"/>` +
      `<rect x="20" width="10" height="20" fill="#16D39A"/>` +
      STAR,
    laneMotif: STAR,
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

  // ONE LONG THING: the flag itself, stretched the whole length of the row.
  // No badge in the corner, no banner, nothing clipped out of it — Ryan asked
  // for a lane three times and I kept putting a small shape inside it instead.
  // ONE LONG THING, in two layers that do not fight.
  //
  // The BANDS are painted stretched across the row, which is honest: a stripe
  // is the same stripe at any width. Anything with a SHAPE — a leaf, a disc,
  // a cedar, a lozenge — is a SECOND background layer, sized `auto` so the
  // browser keeps its proportions, dropped in the gap the scrim leaves clear.
  //
  // It has to be CSS that holds the aspect, not SVG. A nested <svg> with
  // preserveAspectRatio inside a parent drawn with preserveAspectRatio="none"
  // is measured in the parent's user units, and those units are already
  // squashed — so the nested copy came out exactly as stretched as the thing
  // it was meant to fix. Japan's disc stayed an ellipse through two goes at
  // it. `background-size: auto` is measured in pixels, and pixels are square.
  const weights = flag.weights ?? [1, 1, 1];
  const whole = weights.reduce((a, b) => a + b, 0);
  let at = 0;
  const field = flag.bands
    .map((colour, i) => {
      const from = (at / whole) * 100;
      at += weights[i] ?? 1;
      const to = (at / whole) * 100;
      return flag.rows
        ? `<rect y="${from}" width="100" height="${to - from}" fill="${colour}"/>`
        : `<rect x="${from}" width="${to - from}" height="100" fill="${colour}"/>`;
    })
    .join("");
  const url = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

  // The field is told to fill the row and does not care: stripes stretch.
  const fieldUrl = url(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ` +
      `preserveAspectRatio="none">${field}</svg>`,
  );
  // The motif must NOT say preserveAspectRatio="none". That is what took two
  // goes to find: `none` strips an SVG of its intrinsic ratio, so
  // `background-size: auto 100%` had nothing to reason from and fell back to
  // the full width of the row — the exact stretch this exists to undo. With
  // width and height on the root and the default fitting, the image is 3:2
  // and `auto` keeps it that way in PIXELS, which is the only space where a
  // circle is round.
  const motifUrl = url(
    `<svg xmlns="http://www.w3.org/2000/svg" ${XLINK} width="30" height="20" ` +
      `viewBox="0 0 30 20">${flag.laneMotif ?? flag.art}</svg>`,
  );

  const layers = [fieldUrl];
  const sizes = ["100% 100%"];
  const spots = ["0 0"];
  const spot = flag.laneAt === undefined ? 0.76 : flag.laneAt;
  if (spot !== null) {
    layers.push(motifUrl);
    sizes.push("auto 100%");
    spots.push(`${(spot * 100).toFixed(0)}% center`);
  }

  // The ink follows what is under the TEXT. On a horizontal flag that is the
  // MIDDLE band, since the text runs across the middle of the row; on a
  // vertical one it is the first band, where the name sits.
  const ends = flag.rows
    ? lum(flag.bands[Math.floor(flag.bands.length / 2)])
    : lum(flag.bands[0]);
  const light = flag.laneInk ? flag.laneInk === "light" : ends > 0.5;
  const c = light ? "255,255,255" : "8,10,14";
  const a = (v: number) => (v * (flag.laneAlpha ?? 1)).toFixed(2);
  // Left-heavy: solid under the figure, the name and the detail line, thinning
  // only over the right third, which is the one stretch of the row with
  // nothing in it, then firming up again under the points.
  const scrim =
    `linear-gradient(90deg, rgba(${c},${a(0.9)}) 0%, rgba(${c},${a(0.88)}) 56%,` +
    ` rgba(${c},${a(0.46)}) 70%, rgba(${c},${a(0.34)}) 84%, rgba(${c},${a(0.78)}) 100%)`;

  // The scrim goes on top of both, so the text is legible over whichever of
  // them happens to be under it.
  return {
    backgroundImage: [scrim, ...layers.slice().reverse()].join(", "),
    backgroundSize: ["100% 100%", ...sizes.slice().reverse()].join(", "),
    backgroundRepeat: layers.map(() => "no-repeat").concat("no-repeat").join(", "),
    backgroundPosition: ["0 0", ...spots.slice().reverse()].join(", "),
    ...(light ? { "--ink": "#0b1f2d", "--ink-2": "#3f5f74", "--ink-3": "#4e6d80" } : {}),
  };
}
