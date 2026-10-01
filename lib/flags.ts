import { MAPLE, MAPLE_BOX } from "./away";
import { FLAG_ART, FLAG_MOTIF, FLEUR, FLEUR_BOX } from "./flagArt";

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
   * Centred by default. It used to sit at 0.76, in the gap a scrim left
   * clear; there is no scrim any more, so there is no gap to aim for and the
   * middle is simply where a flag's emblem belongs.
   */
  laneAt?: number | null;
  /**
   * Band widths for the LANE only, when the flag's own would put the text
   * across a boundary.
   *
   * A lane is a sixth the height of a flag and has three lines of writing
   * stacked down the middle of it. Jordan's thirds meant the name sat on the
   * white, the detail line on the green and the bar on the join — the only
   * row on the board where the text crossed two colours. Lebanon has always
   * read well at 1:2:1, so Jordan gets the same room. The TAG still draws the
   * flag's true thirds; this is the lane making space for words.
   */
  laneWeights?: number[];
  /**
   * The emblem alone, in the same 30x20 box, when it cannot simply be taken
   * from FLAG_MOTIF — Canada's leaf and Quebec's fleur are HOLES punched in
   * their fields rather than shapes drawn on them, and the house flag's star
   * is ours.
   */
  laneMotif?: string;
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
  { id: "lb", label: "Lebanon", bands: ["#D31624", "#FFFFFF", "#D31624"], rows: true, weights: [1, 2, 1], art: FLAG_ART.lb },
  { id: "it", label: "Italy", bands: ["#009246", "#FFFFFF", "#CE2B37"], art: FLAG_ART.it, laneAt: null },
  { id: "jp", label: "Japan", bands: ["#FFFFFF"], weights: [1], art: FLAG_ART.jp },
  // The chevron belongs at the hoist on a flag, but the hoist of a LANE is
  // under the rank, the figure and the name. It goes to the middle with the
  // rest; the bands are horizontal, so they line up wherever it lands.
  { id: "jo", label: "Jordan", bands: ["#000000", "#FFFFFF", "#007A3D"], rows: true, art: FLAG_ART.jo, laneWeights: [1, 2, 1] },
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
 * There is no wash over it. The flag is its own colours at full strength, so
 * the only thing keeping the row readable is the INK — dark text on a pale
 * flag, light text on a dark one, chosen from whichever band actually lands
 * under the writing.
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

  // The away-week wash, extended to the shop's flags — lib/away.ts has done
  // this since long before the Club existed, and does it better than the
  // full-strength flag that replaced it. Its note is still the best summary
  // of why: a crisp block behind a leaderboard row reads as a rendering
  // fault, a soft one reads as lit.
  //
  // Two kinds of flag, because they fail in opposite directions:
  //
  // DARK under the text — the bands are painted over the deck and FEATHERED,
  // strong at the two ends where the rank and the points sit and dipping
  // through the middle where the name runs. The row stays dark, so the ink
  // stays light.
  //
  // PALE under the text (Japan, Jordan, Lebanon) — fading those toward the
  // deck would put dark ink on a dark row. They paint their field nearly
  // solid instead and take dark ink, which is what away.ts does for Japan and
  // the reason that row has always worked.
  const weights = flag.laneWeights ?? flag.weights ?? [1, 1, 1];
  const whole = weights.reduce((a, b) => a + b, 0);
  let at = 0;
  const bands = flag.bands
    .map((colour, i) => {
      const from = (at / whole) * 100;
      at += weights[i] ?? 1;
      const to = (at / whole) * 100;
      return flag.rows
        ? `<rect y="${from}" width="100" height="${to - from}" fill="${colour}"/>`
        : `<rect x="${from}" width="${to - from}" height="100" fill="${colour}"/>`;
    })
    .join("");

  // The ink follows the band that actually lands under the writing: the
  // MIDDLE one on a horizontal flag, since the text runs across the middle of
  // the row, and the first on a vertical one, where the name sits.
  const light =
    (flag.rows
      ? lum(flag.bands[Math.floor(flag.bands.length / 2)])
      : lum(flag.bands[0])) > 0.5;

  const fid = `${flag.id}-fade`;
  // A mask rather than a stack of gradients: the bands are one drawing and
  // the dip is one shape over them, so a flag with five bands fades exactly
  // like a flag with one.
  const stops = light
    ? [[0, 0.95], [1, 0.95]]
    : [[0, 0.97], [0.16, 0.86], [0.42, 0.22], [0.58, 0.22], [0.84, 0.86], [1, 0.97]];
  const fade =
    `<defs><linearGradient id="${fid}" x1="0" y1="0" x2="1" y2="0">` +
    stops.map(([o, a2]) => `<stop offset="${o}" stop-color="#fff" stop-opacity="${a2}"/>`).join("") +
    `</linearGradient><mask id="${fid}-m"><rect width="100" height="100" fill="url(#${fid})"/></mask></defs>`;

  const url = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  const fieldUrl = url(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ` +
      `preserveAspectRatio="none">${fade}<g mask="url(#${fid}-m)">${bands}</g></svg>`,
  );
  // The emblem is held back too — it sits under the name, and a full-strength
  // leaf there is a blob with writing on it. Still `auto`, because
  // preserveAspectRatio="none" would strip the ratio and stretch it flat.
  const motifUrl = url(
    `<svg xmlns="http://www.w3.org/2000/svg" ${XLINK} width="30" height="20" ` +
      `viewBox="0 0 30 20"><g opacity="0.6">${flag.laneMotif ?? FLAG_MOTIF[flag.id] ?? ""}</g></svg>`,
  );

  const layers = [fieldUrl];
  const sizes = ["100% 100%"];
  const spots = ["0 0"];
  const spot = flag.laneAt === undefined ? 0.5 : flag.laneAt;
  if (spot !== null && (flag.laneMotif || FLAG_MOTIF[flag.id])) {
    layers.push(motifUrl);
    sizes.push("auto 76%");
    spots.push(`${(spot * 100).toFixed(0)}% center`);
  }

  return {
    backgroundImage: layers.slice().reverse().join(", "),
    backgroundSize: sizes.slice().reverse().join(", "),
    backgroundRepeat: layers.map(() => "no-repeat").join(", "),
    backgroundPosition: spots.slice().reverse().join(", "),
    ...(light ? { "--ink": "#0b1f2d", "--ink-2": "#3f5f74", "--ink-3": "#4e6d80" } : {}),
  };
}
