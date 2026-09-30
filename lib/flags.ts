import { MAPLE, MAPLE_BOX } from "./away";

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
  | "disc" // Japan, Argentina's sun, Portugal's armillary
  | "maple" // Canada
  | "cedar" // Lebanon
  | "cross" // Switzerland, Quebec
  | "chevron" // Jordan
  | "star" // Morocco, Vietnam
  | "diamond" // Brazil
  | "union" // Britain — a red cross alone is not a Union Jack
  | "unionCanton" // Australia: the union small, in the corner, with a star
  | "saltire"; // Jamaica

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
   * Colours for the LANE wash, when the tag's own field won't do. Britain and
   * Australia are both a solid navy field with the design carried by the
   * emblem, so their lanes washed identically — you'd be paying twice for one
   * look. Britain's lane takes the union's three colours instead.
   */
  lane?: [string, string, string];
}

/**
 * Ryan asked for Italy, Lebanon, Canada, Quebec, Japan and Jordan by name.
 * The rest are the ones the league would actually claim — places the lads are
 * from, race in, or would fly for a laugh.
 */
export const COUNTRY_FLAGS: CountryFlag[] = [
  { id: "ca", label: "Canada", bands: ["#D52B1E", "#FFFFFF", "#D52B1E"], weights: [1, 2, 1], emblem: { kind: "maple", colour: "#D52B1E" } },
  { id: "qc", label: "Quebec", bands: ["#003DA5", "#003DA5", "#003DA5"], emblem: { kind: "cross", colour: "#FFFFFF" } },
  { id: "lb", label: "Lebanon", bands: ["#ED1C24", "#FFFFFF", "#ED1C24"], rows: true, weights: [1, 2, 1], emblem: { kind: "cedar", colour: "#00A651" } },
  { id: "it", label: "Italy", bands: ["#008C45", "#F4F5F0", "#CD212A"] },
  { id: "jp", label: "Japan", bands: ["#FFFFFF", "#FFFFFF", "#FFFFFF"], emblem: { kind: "disc", colour: "#BC002D" } },
  { id: "jo", label: "Jordan", bands: ["#1A1A1A", "#FFFFFF", "#007A3D"], rows: true, emblem: { kind: "chevron", colour: "#CE1126" } },

  { id: "fr", label: "France", bands: ["#0055A4", "#FFFFFF", "#EF4135"] },
  { id: "es", label: "Spain", bands: ["#AA151B", "#F1BF00", "#AA151B"], rows: true, weights: [1, 2, 1] },
  { id: "pt", label: "Portugal", bands: ["#046A38", "#DA291C", "#DA291C"], emblem: { kind: "disc", colour: "#FFE900" } },
  { id: "gr", label: "Greece", bands: ["#0D5EAF", "#FFFFFF", "#0D5EAF"], rows: true },
  { id: "ie", label: "Ireland", bands: ["#169B62", "#FFFFFF", "#FF883E"] },
  { id: "de", label: "Germany", bands: ["#1A1A1A", "#DD0000", "#FFCE00"], rows: true },
  { id: "nl", label: "Netherlands", bands: ["#AE1C28", "#FFFFFF", "#21468B"], rows: true },
  { id: "ch", label: "Switzerland", bands: ["#D52B1E", "#D52B1E", "#D52B1E"], emblem: { kind: "cross", colour: "#FFFFFF" } },
  { id: "br", label: "Brazil", bands: ["#009739", "#009739", "#009739"], emblem: { kind: "diamond", colour: "#FEDD00" } },
  { id: "ar", label: "Argentina", bands: ["#74ACDF", "#FFFFFF", "#74ACDF"], rows: true, emblem: { kind: "disc", colour: "#F6B40E" } },
  { id: "mx", label: "Mexico", bands: ["#006847", "#FFFFFF", "#CE1126"] },
  { id: "ma", label: "Morocco", bands: ["#C1272D", "#C1272D", "#C1272D"], emblem: { kind: "star", colour: "#006233" } },
  { id: "gb", label: "Britain", bands: ["#012169", "#012169", "#012169"], lane: ["#012169", "#FFFFFF", "#C8102E"], emblem: { kind: "union", colour: "#C8102E" } },
  { id: "au", label: "Australia", bands: ["#012169", "#012169", "#012169"], emblem: { kind: "unionCanton", colour: "#FFFFFF" } },
  { id: "ke", label: "Kenya", bands: ["#1A1A1A", "#BB0000", "#006600"], rows: true },
  { id: "jm", label: "Jamaica", bands: ["#1A1A1A", "#1A1A1A", "#1A1A1A"], emblem: { kind: "saltire", colour: "#FED100" } },
  { id: "vn", label: "Vietnam", bands: ["#DA251D", "#DA251D", "#DA251D"], emblem: { kind: "star", colour: "#FFFF00" } },
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
  const star = (x: number, y: number, r: number, points = 5, inner = 0.42) =>
    `<polygon fill="${colour}" points="${Array.from({ length: points * 2 }, (_, i) => {
      const rad = i % 2 === 0 ? r : r * inner;
      const a = -Math.PI / 2 + (i * Math.PI) / points;
      return `${(x + rad * Math.cos(a)).toFixed(2)},${(y + rad * Math.sin(a)).toFixed(2)}`;
    }).join(" ")}"/>`;

  switch (kind) {
    case "disc":
      return `<circle cx="${cx}" cy="${cy}" r="${h * 0.3}" fill="${colour}"/>`;
    case "maple":
      // The real leaf, from the construction sheet the away tags use.
      return (
        `<svg x="${cx - h * 0.28}" y="${cy - h * 0.3}" width="${h * 0.56}" height="${h * 0.6}" ` +
        `viewBox="${MAPLE_BOX}"><path fill="${colour}" d="${MAPLE}"/></svg>`
      );
    case "cedar":
      return (
        `<g fill="${colour}">` +
        `<polygon points="${cx},${cy - h * 0.34} ${cx + w * 0.11},${cy - h * 0.06} ${cx - w * 0.11},${cy - h * 0.06}"/>` +
        `<polygon points="${cx},${cy - h * 0.2} ${cx + w * 0.15},${cy + h * 0.12} ${cx - w * 0.15},${cy + h * 0.12}"/>` +
        `<rect x="${cx - w * 0.018}" y="${cy + h * 0.1}" width="${w * 0.036}" height="${h * 0.2}"/></g>`
      );
    case "cross":
      return (
        `<g fill="${colour}">` +
        `<rect x="${cx - w * 0.06}" y="${h * 0.1}" width="${w * 0.12}" height="${h * 0.8}"/>` +
        `<rect x="${w * 0.22}" y="${cy - h * 0.09}" width="${w * 0.56}" height="${h * 0.18}"/></g>`
      );
    case "chevron":
      return `<polygon points="0,0 ${w * 0.36},${cy} 0,${h}" fill="${colour}"/>`;
    case "diamond":
      // Brazil: the yellow lozenge AND the blue globe with its band — a bare
      // diamond is a different flag.
      return (
        `<polygon points="${cx},${h * 0.12} ${w * 0.84},${cy} ${cx},${h * 0.88} ${w * 0.16},${cy}" fill="${colour}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${h * 0.22}" fill="#012169"/>` +
        `<path d="M${cx - h * 0.22},${cy - h * 0.04} Q${cx},${cy + h * 0.14} ${cx + h * 0.22},${cy - h * 0.04}` +
        ` L${cx + h * 0.22},${cy + h * 0.02} Q${cx},${cy + h * 0.2} ${cx - h * 0.22},${cy + h * 0.02} Z" fill="#FFFFFF"/>`
      );
    case "star":
      return star(cx, cy, h * 0.3);
    case "union":
      return (
        `<g fill="none">` +
        `<path d="M0,0 L${w},${h} M${w},0 L0,${h}" stroke="#FFFFFF" stroke-width="${h * 0.3}"/>` +
        `<path d="M0,0 L${w},${h} M${w},0 L0,${h}" stroke="${colour}" stroke-width="${h * 0.14}"/>` +
        `<path d="M${cx},0 V${h} M0,${cy} H${w}" stroke="#FFFFFF" stroke-width="${h * 0.34}"/>` +
        `<path d="M${cx},0 V${h} M0,${cy} H${w}" stroke="${colour}" stroke-width="${h * 0.2}"/></g>`
      );
    case "unionCanton": {
      const uw = w * 0.42;
      const uh = h * 0.5;
      return (
        `<g fill="none">` +
        `<path d="M0,0 L${uw},${uh} M${uw},0 L0,${uh}" stroke="${colour}" stroke-width="${uh * 0.26}"/>` +
        `<path d="M${uw / 2},0 V${uh} M0,${uh / 2} H${uw}" stroke="${colour}" stroke-width="${uh * 0.3}"/></g>` +
        star(uw / 2, uh + h * 0.22, h * 0.2, 7, 0.45) +
        `<circle cx="${w * 0.78}" cy="${h * 0.3}" r="${h * 0.09}" fill="${colour}"/>` +
        `<circle cx="${w * 0.7}" cy="${h * 0.62}" r="${h * 0.07}" fill="${colour}"/>` +
        `<circle cx="${w * 0.88}" cy="${h * 0.66}" r="${h * 0.07}" fill="${colour}"/>`
      );
    }
    case "saltire":
      return (
        `<polygon points="${cx},${cy} ${w * 0.16},0 ${w * 0.84},0" fill="#009B3A"/>` +
        `<polygon points="${cx},${cy} ${w * 0.16},${h} ${w * 0.84},${h}" fill="#009B3A"/>` +
        `<path d="M0,0 L${w},${h} M${w},0 L0,${h}" stroke="${colour}" stroke-width="${h * 0.22}" fill="none"/>`
      );
    default:
      return "";
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
