import sprites from "./avatar/sprites.json";

/**
 * The avatar: one pixel figure per athlete, dressed from the Club's shop.
 *
 * The art is GENERATED, not drawn — scripts/gen-avatar.py builds every sprite
 * from a single set of proportion constants into lib/avatar/sprites.json. That
 * is why a new item costs a few shapes rather than an illustration, and why the
 * figure's build can be changed in one edit.
 *
 * Two rules do the work that would otherwise be per-item drawing:
 *   - the black outline is derived (any empty cell touching a filled one), with
 *     a cool rim on left-hand edges, which is what lifts the figure off a dark
 *     background;
 *   - lighting comes from the upper left, applied per row of each layer.
 *
 * Items carry their own resolution. The body is one cell per unit; helmets and
 * eyewear are three or four; the watch is four. Mixing is deliberate: small hard
 * objects need finer cells, and the same rules light them all.
 */

export type Slot = "head" | "eyes" | "torso" | "legs" | "feet" | "socks" | "watch";

export interface AvatarItem {
  id: string;
  slot: Slot;
  label: string;
  /** Tri coins. 0 means it comes with the figure. */
  price: number;
  tier: "common" | "rare" | "epic" | "legendary";
  /** Key into the sprite data; absent for "wear nothing here". */
  sprite?: string;
  /** Some items look different from behind — only the aero helmet, so far. */
  spriteBack?: string;
  /** A visor is the eyewear: it hides whatever is in the eyes slot. */
  coversEyes?: boolean;
}

/** What each athlete is wearing, and in what colours. */
export interface Loadout {
  [slot: string]: { item: string; colour: string; accent?: string };
}

export const AVATAR_ITEMS: AvatarItem[] = [
  { id: "head.none", slot: "head", label: "Bare", price: 0, tier: "common" },
  { id: "head.helmet", slot: "head", label: "Helmet", price: 400, tier: "rare", sprite: "helmet" },
  { id: "head.swimcap", slot: "head", label: "Swim cap", price: 150, tier: "common", sprite: "swimcap" },
  { id: "head.runcap", slot: "head", label: "Run cap", price: 200, tier: "common", sprite: "runcap" },
  { id: "head.aero", slot: "head", label: "Aero helmet", price: 900, tier: "epic", sprite: "aero", spriteBack: "aero_back", coversEyes: true },
  { id: "eyes.none", slot: "eyes", label: "None", price: 0, tier: "common" },
  { id: "eyes.shades", slot: "eyes", label: "Shades", price: 400, tier: "rare", sprite: "shades" },
  { id: "eyes.goggles", slot: "eyes", label: "Goggles", price: 150, tier: "common", sprite: "goggles" },
  { id: "torso.bare", slot: "torso", label: "Bare", price: 0, tier: "common" },
  { id: "torso.jersey", slot: "torso", label: "Cycling jersey", price: 500, tier: "rare", sprite: "jersey" },
  { id: "torso.tee", slot: "torso", label: "Running shirt", price: 350, tier: "common", sprite: "tee" },
  { id: "torso.trisuit", slot: "torso", label: "Tri suit", price: 900, tier: "epic", sprite: "trisuit" },
  { id: "legs.bibs", slot: "legs", label: "Bib shorts", price: 500, tier: "rare", sprite: "bibs" },
  { id: "legs.runshorts", slot: "legs", label: "Running shorts", price: 150, tier: "common", sprite: "runshorts" },
  { id: "legs.jammers", slot: "legs", label: "Jammers", price: 200, tier: "common", sprite: "jammers" },
  { id: "feet.barefoot", slot: "feet", label: "Barefoot", price: 0, tier: "common", sprite: "barefoot" },
  { id: "feet.bikeshoes", slot: "feet", label: "Cycling shoes", price: 500, tier: "rare", sprite: "bikeshoes" },
  { id: "feet.runshoes", slot: "feet", label: "Running shoes", price: 600, tier: "rare", sprite: "runshoes" },
  { id: "feet.carbon", slot: "feet", label: "Carbon plate", price: 1500, tier: "legendary", sprite: "carbon" },
  { id: "socks.none", slot: "socks", label: "None", price: 0, tier: "common" },
  { id: "socks.short", slot: "socks", label: "Short socks", price: 100, tier: "common", sprite: "socks_short" },
  { id: "socks.tall", slot: "socks", label: "Tall socks", price: 150, tier: "common", sprite: "socks_tall" },
  { id: "watch.none", slot: "watch", label: "Off", price: 0, tier: "common" },
  { id: "watch.on", slot: "watch", label: "GPS watch", price: 300, tier: "common", sprite: "watch" },
];

/**
 * Does this item have a second colour? Derived from the sprite, not declared:
 * an "A" cell is the accent, so the locker offers an accent picker exactly
 * where one changes something and nowhere else.
 */
export function usesAccent(itemId: string): boolean {
  const item = AVATAR_ITEM_BY_ID.get(itemId);
  if (!item?.sprite) return false;
  const sheets = [item.sprite, item.spriteBack].filter(Boolean) as string[];
  return sheets.some((name) => DATA.g[name]?.rows.some((r) => r.includes("A")));
}

export const AVATAR_ITEM_BY_ID = new Map(AVATAR_ITEMS.map((i) => [i.id, i]));

/** What a new athlete turns up in, before they've bought anything. */
export const DEFAULT_LOADOUT: Loadout = {
  head: { item: "head.none", colour: "#d4147e" },
  eyes: { item: "eyes.none", colour: "#20242b" },
  torso: { item: "torso.tee", colour: "#d4147e", accent: "#f3f3f1" },
  legs: { item: "legs.runshorts", colour: "#20242b" },
  feet: { item: "feet.runshoes", colour: "#f3f3f1", accent: "#d4147e" },
  socks: { item: "socks.short", colour: "#f3f3f1" },
  watch: { item: "watch.none", colour: "#20242b" },
};

const SKIN = "#dda077", SKIN_D = "#b2764f", HAIR = "#33241a";
const EYE = "#1b1410", MOUTH = "#b5705a", LIGHT = "#f3f3f1";
const OUTLINE = "#14161b";
const RIM = "#4a5f7a"; // the cool edge on the lit side

// Legs first, eyewear last: the order things are put on.
const ORDER: Slot[] = ["legs", "socks", "feet", "torso", "watch", "head", "eyes"];
// Worn on the chest, so these ride with the breath.
const UPPER: Set<Slot> = new Set(["head", "eyes", "torso", "watch"]);

type Sheet = { res: number; x0: number; y0: number; rows: string[] };
const DATA = sprites as unknown as {
  W: number; H: number; base: string[]; back: string[]; g: Record<string, Sheet>;
};

function shift(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255))
    .toString(16)
    .padStart(6, "0")}`;
}

/**
 * The figure as an SVG string.
 *
 * `crop` picks the framing: the whole figure, or head and shoulders for the
 * 36px bust that sits in the Board's lanes — the same drawing either way.
 */
export function avatarSvg(
  loadout: Loadout,
  { view = "front", crop = "full" }: { view?: "front" | "back"; crop?: "full" | "bust" } = {},
): string {
  const { W, H, g } = DATA;
  const src = view === "back" ? DATA.back : DATA.base;
  const headItem = AVATAR_ITEM_BY_ID.get(loadout.head?.item ?? "");

  type Layer = { grid: (string | null)[][]; res: number; x0: number; y0: number; w: number; h: number; upper: boolean };
  const layers: Layer[] = [];

  const paint = (
    rows: string[], res: number, x0: number, y0: number,
    colour: string, accent: string, mirror: boolean, upper: boolean,
  ) => {
    const w = rows[0].length, h = rows.length;
    const grid: (string | null)[][] = Array.from({ length: h }, () => new Array(w).fill(null));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === ".") continue;
        const sx = mirror ? w - 1 - x : x;
        grid[y][sx] =
          ch === "S" ? SKIN : ch === "D" ? SKIN_D : ch === "H" ? HAIR :
          ch === "E" ? EYE : ch === "M" ? MOUTH : ch === "W" ? LIGHT :
          ch === "A" ? accent : colour;
      }
    }
    // Light from the upper left, proportional to this layer's density.
    const span = Math.max(1, Math.round(3 * res));
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        const c = grid[y][x];
        if (!c || c === EYE || c === MOUTH || c === LIGHT) { x++; continue; }
        let end = x;
        while (end + 1 < w && grid[y][end + 1] === c) end++;
        const len = end - x + 1;
        if (len >= span * 2 + 1) {
          for (let k = 0; k < Math.max(1, Math.round(res)); k++) grid[y][x + k] = shift(c, 1.1);
          for (let k = 0; k < span; k++) grid[y][end - k] = shift(c, 0.72 + 0.07 * k);
        } else if (len >= Math.max(2, Math.round(1.5 * res))) {
          grid[y][end] = shift(c, 0.8);
        }
        x = end + 1;
      }
    }
    layers.push({ grid, res, x0: mirror ? W * res - (x0 + w) : x0, y0, w, h, upper });
  };

  const SPLIT = 86; // the hips: above it breathes, below it stays planted
  paint(src.slice(0, SPLIT), 1, 0, 0, SKIN, SKIN_D, false, true);
  paint(src.slice(SPLIT), 1, 0, SPLIT, SKIN, SKIN_D, false, false);

  for (const slot of ORDER) {
    const worn = loadout[slot];
    const item = worn ? AVATAR_ITEM_BY_ID.get(worn.item) : undefined;
    if (!item?.sprite) continue;
    if (slot === "eyes" && headItem?.coversEyes) continue;
    const sheet = g[(view === "back" && item.spriteBack) || item.sprite];
    if (!sheet) continue;
    paint(sheet.rows, sheet.res, sheet.x0, sheet.y0, worn.colour,
      worn.accent ?? LIGHT, view === "back", UPPER.has(slot));
  }

  let upperOut = "", lowerOut = "";
  for (const L of layers) {
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= L.w || y >= L.h ? null : L.grid[y][x]);
    const u = 1 / L.res, ox = L.x0 / L.res, oy = L.y0 / L.res;
    let edges = "", cells = "";
    const emit = (x: number, y: number, len: number, colour: string | null) => {
      const X = (ox + x * u).toFixed(3), Y = (oy + y * u).toFixed(3);
      const Wd = (len * u + u * 0.02).toFixed(3), Ht = (u * 1.02).toFixed(3);
      const r = `<rect x="${X}" y="${Y}" width="${Wd}" height="${Ht}"`;
      if (colour) cells += `${r} fill="${colour}"/>`;
      else edges += `${r}/>`;
    };
    // One rect per RUN of colour — a few hundred nodes instead of thousands.
    for (let y = 0; y < L.h; y++) {
      let runStart = -1, runColour: string | null = null;
      const flush = (x: number) => {
        if (runStart >= 0) emit(runStart, y, x - runStart, runColour);
        runStart = -1; runColour = null;
      };
      for (let x = 0; x <= L.w; x++) {
        const c = x < L.w ? L.grid[y][x] : undefined;
        let paintAs: string | null = null;
        if (c) paintAs = c;
        else if (x < L.w && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) {
          paintAs = at(x + 1, y) && !at(x - 1, y) ? RIM : null;
          if (paintAs === null) { flush(x); emit(x, y, 1, null); continue; }
        }
        if (paintAs !== runColour) { flush(x); if (paintAs) { runStart = x; runColour = paintAs; } }
      }
      flush(L.w);
    }
    const chunk = `<g fill="${OUTLINE}">${edges}</g>${cells}`;
    if (L.upper) upperOut += chunk; else lowerOut += chunk;
  }

  const box = crop === "bust" ? "14 2 52 52" : `-1 0 ${W + 2} ${H}`;
  return (
    `<svg viewBox="${box}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" ` +
    `role="img" aria-label="Pixel avatar"><g class="avatar-breath">${upperOut}</g>${lowerOut}</svg>`
  );
}
