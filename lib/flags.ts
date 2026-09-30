import { MAPLE, MAPLE_BOX } from "./away";
import { CEDAR, CEDAR_BOX, FLEUR, FLEUR_BOX, QC_QUARTER } from "./flagArt";

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

export type Emblem =
  | "disc" // Japan
  | "maple" // Canada
  | "cedar" // Lebanon
  | "fleurdelise" // Quebec: the cross and all four fleurs-de-lis
  | "chevron" // Jordan, with its seven-pointed star
  | "star" // the house flag
  | "diamond" // Brazil: the lozenge, the globe and its band
  | "shield"; // Kenya: the Maasai shield and the crossed spears

export interface CountryFlag {
  id: string;
  label: string;
  /** Two or three bands, hoist to fly (or top to bottom when `rows`). */
  bands: string[];
  /** Horizontal bands rather than vertical. */
  rows?: boolean;
  /** Relative band widths — Canada is 1:2:1, not thirds. */
  weights?: number[];
  emblem?: { kind: Emblem; colour: string };
  /**
   * The whole flag, exactly, as SVG innards in the 30x20 tag space.
   *
   * When a flag has real artwork this replaces bands + emblem for the TAG and
   * the big view. The lane still works off `bands` and `emblem`, because a
   * lane is a wide wash and stretching a whole flag across one distorts it.
   */
  art?: string;
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
  { id: "ca", label: "Canada", bands: ["#D52B1E", "#FFFFFF", "#D52B1E"], weights: [1, 2, 1], emblem: { kind: "maple", colour: "#D52B1E" } },
  // The Fleurdelisé is a white cross AND a fleur-de-lis in each quarter. With
  // only the cross it was Finland in the wrong colours.
  {
    id: "qc", label: "Quebec", bands: ["#003DA5"], weights: [1],
    emblem: { kind: "fleurdelise", colour: "#FFFFFF" },
    // Four quarters at the spacings the official file uses, each one the blue
    // field with its fleur punched out; the white beneath shows through.
    art:
      `<rect width="30" height="20" fill="#FFFFFF"/><g transform="scale(0.003125)" fill="#003DA5">` +
      [[0, 0], [5600, 0], [0, 4000], [5600, 4000]]
        .map(([x, y]) => `<path transform="translate(${x},${y})" d="${QC_QUARTER}"/>`)
        .join("") +
      `</g>`,
  },
  {
    id: "lb", label: "Lebanon", bands: ["#D31624", "#FFFFFF", "#D31624"], rows: true, weights: [1, 2, 1],
    emblem: { kind: "cedar", colour: "#008C3E" },
    art:
      `<rect width="30" height="5" fill="#D31624"/><rect y="5" width="30" height="10" fill="#FFFFFF"/>` +
      `<rect y="15" width="30" height="5" fill="#D31624"/>` +
      `<g transform="scale(0.0104166667)"><path fill="#008C3E" d="${CEDAR}"/></g>`,
  },
  { id: "it", label: "Italy", bands: ["#008C45", "#F4F5F0", "#CD212A"] },
  // The disc is three fifths of the height, which is what makes it Japan and
  // not a red dot on a white field.
  { id: "jp", label: "Japan", bands: ["#FFFFFF"], weights: [1], emblem: { kind: "disc", colour: "#BC002D" } },
  { id: "jo", label: "Jordan", bands: ["#1A1A1A", "#FFFFFF", "#007A3D"], rows: true, emblem: { kind: "chevron", colour: "#CE1126" } },
  { id: "br", label: "Brazil", bands: ["#009739"], weights: [1], emblem: { kind: "diamond", colour: "#FEDD00" } },
  // Five bands, not three: the white fimbriations are part of the flag, and
  // the Maasai shield is the whole point of it.
  { id: "ke", label: "Kenya", bands: ["#1A1A1A", "#FFFFFF", "#BB0000", "#FFFFFF", "#006600"], rows: true, weights: [6, 1, 6, 1, 6], emblem: { kind: "shield", colour: "#FFFFFF" } },
  { id: "ama", label: "AmaComp", bands: ["#D4147E", "#101215", "#16D39A"], emblem: { kind: "star", colour: "#C9A227" } },
];

export const FLAG_BY_ID = new Map(COUNTRY_FLAGS.map((f) => [f.id, f]));

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
  const W = 30;
  const H = 20;
  if (flag.art) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${flag.art}</svg>`;
  }
  const weights = flag.weights ?? [1, 1, 1];
  const total = weights.reduce((a, b) => a + b, 0);
  const span = flag.rows ? H : W;

  let at = 0;
  let out = "";
  for (let i = 0; i < flag.bands.length; i++) {
    const from = (at / total) * span;
    at += weights[i] ?? 1;
    const to = (at / total) * span;
    out += flag.rows
      ? `<rect x="0" y="${from}" width="${W}" height="${to - from}" fill="${flag.bands[i]}"/>`
      : `<rect x="${from}" y="0" width="${to - from}" height="${H}" fill="${flag.bands[i]}"/>`;
  }
  if (flag.emblem) out += emblem(flag.emblem.kind, flag.emblem.colour, W, H);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${out}</svg>`;
}

function emblem(kind: Emblem, colour: string, w: number, h: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const star = (x: number, y: number, r: number, points = 5, inner = 0.42, fill = colour) =>
    `<polygon fill="${fill}" points="${Array.from({ length: points * 2 }, (_, i) => {
      const rad = i % 2 === 0 ? r : r * inner;
      const a = -Math.PI / 2 + (i * Math.PI) / points;
      return `${(x + rad * Math.cos(a)).toFixed(2)},${(y + rad * Math.sin(a)).toFixed(2)}`;
    }).join(" ")}"/>`;

  switch (kind) {
    case "disc":
      // Three fifths of the height, per the Japanese specification.
      return `<circle cx="${cx}" cy="${cy}" r="${h * 0.3}" fill="${colour}"/>`;
    case "maple":
      // The real leaf, from the construction sheet the away tags use.
      return (
        `<svg x="${cx - h * 0.28}" y="${cy - h * 0.3}" width="${h * 0.56}" height="${h * 0.6}" ` +
        `viewBox="${MAPLE_BOX}"><path fill="${colour}" d="${MAPLE}"/></svg>`
      );
    case "cedar":
      // The real cedar, square in its own box, same as Canada's leaf.
      return (
        `<svg x="${cx - h * 0.4}" y="${cy - h * 0.4}" width="${h * 0.8}" height="${h * 0.8}" ` +
        `viewBox="${CEDAR_BOX}"><path fill="${colour}" d="${CEDAR}"/></svg>`
      );
    case "fleurdelise": {
      // One fleur, not the whole flag. A lane is a wide wash; a cross drawn
      // across it would have to reach the ends of the row, and the four
      // quarters shrink to porridge at this size.
      const fh = h * 0.86;
      const fw = fh * (1172 / 1600);
      return (
        `<svg x="${cx - fw / 2}" y="${cy - fh / 2}" width="${fw}" height="${fh}" ` +
        `viewBox="${FLEUR_BOX}"><path fill="${colour}" d="${FLEUR}"/></svg>`
      );
    }
    case "chevron":
      // A third of the length, with the seven-pointed star of the Hashemites.
      return (
        `<polygon points="0,0 ${w / 3},${cy} 0,${h}" fill="${colour}"/>` +
        star(w * 0.115, cy, h * 0.17, 7, 0.5, "#FFFFFF")
      );
    case "diamond": {
      // The lozenge, the globe, its band, and enough stars to be a sky.
      const r = h * 0.22;
      // Small and scattered. Two big ones near the top became a pair of eyes
      // and the band under them became a smile.
      const sky = [
        [-0.11, -0.12, 0.022], [0.05, -0.15, 0.019], [0.14, -0.04, 0.020],
        [-0.16, -0.02, 0.018], [-0.02, -0.07, 0.026], [0.09, 0.05, 0.017],
        [-0.07, 0.04, 0.016], [0.16, 0.08, 0.015], [-0.14, 0.10, 0.015],
        [0.02, 0.13, 0.018], [-0.05, -0.16, 0.014],
      ] as const;
      return (
        `<polygon points="${cx},${h * 0.1} ${w * 0.855},${cy} ${cx},${h * 0.9} ${w * 0.145},${cy}" fill="${colour}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#012169"/>` +
        sky.map(([dx, dy, rr]) =>
          `<circle cx="${(cx + dx * h).toFixed(2)}" cy="${(cy + dy * h).toFixed(2)}" r="${(rr * h).toFixed(2)}" fill="#FFFFFF"/>`).join("") +
        `<path d="M${cx - r},${cy - h * 0.035} Q${cx},${cy + h * 0.145} ${cx + r},${cy - h * 0.035}` +
        ` L${cx + r},${cy + h * 0.03} Q${cx},${cy + h * 0.21} ${cx - r},${cy + h * 0.03} Z" fill="#FFFFFF"/>`
      );
    }
    case "star":
      return star(cx, cy, h * 0.3);
    case "shield": {
      // Two spears crossed behind a Maasai shield: black and red, with white
      // between. Without it Kenya is three stripes anyone could be.
      const sh = h * 0.72;
      const sw = w * 0.21;
      return (
        // The spears sit BEHIND the shield and barely out-reach it. Drawn any
        // longer they stop being spears and become a cross through the flag.
        `<g stroke="#FFFFFF" stroke-width="${h * 0.035}" stroke-linecap="round">` +
        `<line x1="${cx - w * 0.075}" y1="${cy - sh * 0.60}" x2="${cx + w * 0.075}" y2="${cy + sh * 0.60}"/>` +
        `<line x1="${cx + w * 0.075}" y1="${cy - sh * 0.60}" x2="${cx - w * 0.075}" y2="${cy + sh * 0.60}"/></g>` +
        `<path d="M${cx},${cy - sh / 2} Q${cx + sw},${cy} ${cx},${cy + sh / 2} Q${cx - sw},${cy} ${cx},${cy - sh / 2} Z" fill="#FFFFFF"/>` +
        `<path d="M${cx},${cy - sh * 0.42} Q${cx + sw * 0.72},${cy} ${cx},${cy + sh * 0.42} Q${cx - sw * 0.72},${cy} ${cx},${cy - sh * 0.42} Z" fill="#1A1A1A"/>` +
        `<path d="M${cx},${cy - sh * 0.2} Q${cx + sw * 0.64},${cy} ${cx},${cy + sh * 0.2} Q${cx - sw * 0.64},${cy} ${cx},${cy - sh * 0.2} Z" fill="#BB0000"/>` +
        `<rect x="${cx - sw * 0.1}" y="${cy - sh * 0.3}" width="${sw * 0.2}" height="${sh * 0.6}" fill="#FFFFFF"/>`
      );
    }
  }
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

  const layers = [scrim];
  const sizes = ["100% 100%"];
  const spots = ["0 0"];
  if (flag.emblem) {
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">` +
        `${emblem(flag.emblem.kind, flag.emblem.colour, 30, 20)}</svg>`,
    );
    layers.push(`url("data:image/svg+xml,${svg}")`);
    sizes.push("auto 64%");
    // Every emblem sits in the right third now. It used to follow the real
    // flag's hoist, which put a cedar or a maple leaf directly behind the
    // athlete's figure and his name; the right third is the only stretch of
    // the row where it is visible AND in nobody's way.
    // 74%, not further right: the wide emblems (a union canton, a saltire)
    // are as broad as they are tall and would otherwise run under the points.
    spots.push("74% center");
  }
  layers.push(bands);
  sizes.push("100% 100%");
  spots.push("0 0");

  return {
    backgroundImage: layers.join(", "),
    backgroundSize: sizes.join(", "),
    backgroundRepeat: layers.map(() => "no-repeat").join(", "),
    backgroundPosition: spots.join(", "),
    ...(light ? { "--ink": "#0b1f2d", "--ink-2": "#3f5f74", "--ink-3": "#4e6d80" } : {}),
  };
}
