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
  { id: "gb", label: "Britain", bands: ["#012169", "#012169", "#012169"], emblem: { kind: "union", colour: "#C8102E" } },
  { id: "au", label: "Australia", bands: ["#012169", "#012169", "#012169"], emblem: { kind: "unionCanton", colour: "#FFFFFF" } },
  { id: "ke", label: "Kenya", bands: ["#1A1A1A", "#BB0000", "#006600"], rows: true },
  { id: "jm", label: "Jamaica", bands: ["#1A1A1A", "#1A1A1A", "#1A1A1A"], emblem: { kind: "saltire", colour: "#FED100" } },
  { id: "vn", label: "Vietnam", bands: ["#DA251D", "#DA251D", "#DA251D"], emblem: { kind: "star", colour: "#FFFF00" } },
  { id: "ama", label: "AmaComp", bands: ["#D4147E", "#101215", "#16D39A"], emblem: { kind: "star", colour: "#C9A227" } },
];

export const FLAG_BY_ID = new Map(COUNTRY_FLAGS.map((f) => [f.id, f]));
