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
  /** The colour it is. Not a setting — a magenta jersey IS a different item. */
  colour: string;
  /** Trim, where the sprite has any. */
  accent: string;
  /** Key into the sprite data; absent for "wear nothing here". */
  sprite?: string;
  /** Some items look different from behind — only the aero helmet, so far. */
  spriteBack?: string;
  /** A visor is the eyewear: it hides whatever is in the eyes slot. */
  coversEyes?: boolean;
}

/** What each athlete is wearing: one item per slot, and that's the whole of it. */
export interface Loadout {
  [slot: string]: { item: string };
}

const SKIN_C = "#dda077", WHITE = "#f3f3f1", BLACK = "#20242b";
const MAGENTA = "#d4147e", MINT = "#16d39a", CYAN = "#00c6c8";
const GOLD = "#c9a227", ORANGE = "#ff7a29", LIME = "#5f9a12";

/**
 * The rack. Colour is not a dimension you buy on top of a garment: the magenta
 * jersey and the black jersey are two items, priced on their own, and owning one
 * says nothing about the other. Sprites are shared between them — the art is the
 * garment, the item is the garment in a colour.
 */
export const AVATAR_ITEMS: AvatarItem[] = [
  { id: "head.none", slot: "head", label: "Bare head", price: 0, tier: "common", colour: SKIN_C, accent: WHITE },
  { id: "head.helmet.magenta", slot: "head", label: "Magenta helmet", price: 400, tier: "rare", colour: MAGENTA, accent: WHITE, sprite: "helmet" },
  { id: "head.helmet.black", slot: "head", label: "Black helmet", price: 400, tier: "rare", colour: BLACK, accent: WHITE, sprite: "helmet" },
  { id: "head.swimcap.cyan", slot: "head", label: "Cyan swim cap", price: 150, tier: "common", colour: CYAN, accent: WHITE, sprite: "swimcap" },
  { id: "head.swimcap.magenta", slot: "head", label: "Magenta swim cap", price: 150, tier: "common", colour: MAGENTA, accent: WHITE, sprite: "swimcap" },
  { id: "head.runcap.mint", slot: "head", label: "Mint run cap", price: 200, tier: "common", colour: MINT, accent: WHITE, sprite: "runcap" },
  { id: "head.runcap.white", slot: "head", label: "White run cap", price: 200, tier: "common", colour: WHITE, accent: BLACK, sprite: "runcap" },
  { id: "head.aero.black", slot: "head", label: "Black aero helmet", price: 900, tier: "epic", colour: BLACK, accent: GOLD, sprite: "aero", spriteBack: "aero_back", coversEyes: true },
  { id: "head.aero.gold", slot: "head", label: "Gold aero helmet", price: 1200, tier: "legendary", colour: GOLD, accent: BLACK, sprite: "aero", spriteBack: "aero_back", coversEyes: true },

  { id: "eyes.none", slot: "eyes", label: "No eyewear", price: 0, tier: "common", colour: BLACK, accent: WHITE },
  { id: "eyes.shades.black", slot: "eyes", label: "Black shades", price: 400, tier: "rare", colour: BLACK, accent: WHITE, sprite: "shades" },
  { id: "eyes.shades.gold", slot: "eyes", label: "Gold shades", price: 500, tier: "epic", colour: GOLD, accent: BLACK, sprite: "shades" },
  { id: "eyes.goggles.cyan", slot: "eyes", label: "Cyan goggles", price: 150, tier: "common", colour: CYAN, accent: "#9fdfe4", sprite: "goggles" },
  { id: "eyes.goggles.black", slot: "eyes", label: "Black goggles", price: 150, tier: "common", colour: BLACK, accent: "#9fdfe4", sprite: "goggles" },

  { id: "torso.bare", slot: "torso", label: "Bare chest", price: 0, tier: "common", colour: SKIN_C, accent: WHITE },
  { id: "torso.tee.magenta", slot: "torso", label: "Magenta running shirt", price: 350, tier: "common", colour: MAGENTA, accent: WHITE, sprite: "tee" },
  { id: "torso.tee.mint", slot: "torso", label: "Mint running shirt", price: 350, tier: "common", colour: MINT, accent: WHITE, sprite: "tee" },
  { id: "torso.tee.white", slot: "torso", label: "White running shirt", price: 350, tier: "common", colour: WHITE, accent: BLACK, sprite: "tee" },
  { id: "torso.jersey.magenta", slot: "torso", label: "Magenta cycling jersey", price: 500, tier: "rare", colour: MAGENTA, accent: WHITE, sprite: "jersey" },
  { id: "torso.jersey.black", slot: "torso", label: "Black cycling jersey", price: 500, tier: "rare", colour: BLACK, accent: WHITE, sprite: "jersey" },
  { id: "torso.jersey.gold", slot: "torso", label: "Gold cycling jersey", price: 750, tier: "epic", colour: GOLD, accent: BLACK, sprite: "jersey" },
  { id: "torso.trisuit.black", slot: "torso", label: "Black tri suit", price: 900, tier: "epic", colour: BLACK, accent: GOLD, sprite: "trisuit" },
  { id: "torso.trisuit.cyan", slot: "torso", label: "Cyan tri suit", price: 900, tier: "epic", colour: CYAN, accent: WHITE, sprite: "trisuit" },

  { id: "legs.runshorts.black", slot: "legs", label: "Black running shorts", price: 0, tier: "common", colour: BLACK, accent: WHITE, sprite: "runshorts" },
  { id: "legs.runshorts.lime", slot: "legs", label: "Lime running shorts", price: 150, tier: "common", colour: LIME, accent: WHITE, sprite: "runshorts" },
  { id: "legs.bibs.black", slot: "legs", label: "Black bib shorts", price: 500, tier: "rare", colour: BLACK, accent: WHITE, sprite: "bibs" },
  { id: "legs.bibs.magenta", slot: "legs", label: "Magenta bib shorts", price: 500, tier: "rare", colour: MAGENTA, accent: WHITE, sprite: "bibs" },
  { id: "legs.jammers.black", slot: "legs", label: "Black jammers", price: 200, tier: "common", colour: BLACK, accent: WHITE, sprite: "jammers" },
  { id: "legs.jammers.cyan", slot: "legs", label: "Cyan jammers", price: 200, tier: "common", colour: CYAN, accent: WHITE, sprite: "jammers" },

  { id: "feet.barefoot", slot: "feet", label: "Barefoot", price: 0, tier: "common", colour: SKIN_C, accent: WHITE, sprite: "barefoot" },
  { id: "feet.runshoes.white", slot: "feet", label: "White running shoes", price: 600, tier: "rare", colour: WHITE, accent: MAGENTA, sprite: "runshoes" },
  { id: "feet.runshoes.orange", slot: "feet", label: "Orange running shoes", price: 600, tier: "rare", colour: ORANGE, accent: WHITE, sprite: "runshoes" },
  { id: "feet.bikeshoes.white", slot: "feet", label: "White cycling shoes", price: 500, tier: "rare", colour: WHITE, accent: MAGENTA, sprite: "bikeshoes" },
  { id: "feet.bikeshoes.black", slot: "feet", label: "Black cycling shoes", price: 500, tier: "rare", colour: BLACK, accent: GOLD, sprite: "bikeshoes" },
  { id: "feet.carbon.gold", slot: "feet", label: "Gold carbon plate", price: 1500, tier: "legendary", colour: GOLD, accent: BLACK, sprite: "carbon" },
  { id: "feet.carbon.mint", slot: "feet", label: "Mint carbon plate", price: 1500, tier: "legendary", colour: MINT, accent: BLACK, sprite: "carbon" },

  { id: "socks.none", slot: "socks", label: "No socks", price: 0, tier: "common", colour: WHITE, accent: BLACK },
  { id: "socks.short.white", slot: "socks", label: "White short socks", price: 100, tier: "common", colour: WHITE, accent: BLACK, sprite: "socks_short" },
  { id: "socks.short.black", slot: "socks", label: "Black short socks", price: 100, tier: "common", colour: BLACK, accent: WHITE, sprite: "socks_short" },
  { id: "socks.tall.white", slot: "socks", label: "White tall socks", price: 150, tier: "common", colour: WHITE, accent: BLACK, sprite: "socks_tall" },
  { id: "socks.tall.magenta", slot: "socks", label: "Magenta tall socks", price: 150, tier: "common", colour: MAGENTA, accent: WHITE, sprite: "socks_tall" },

  { id: "watch.none", slot: "watch", label: "No watch", price: 0, tier: "common", colour: BLACK, accent: MINT },
  { id: "watch.on.black", slot: "watch", label: "Black GPS watch", price: 300, tier: "common", colour: BLACK, accent: MINT, sprite: "watch" },
  { id: "watch.on.gold", slot: "watch", label: "Gold GPS watch", price: 450, tier: "rare", colour: GOLD, accent: BLACK, sprite: "watch" },
];

export const AVATAR_ITEM_BY_ID = new Map(AVATAR_ITEMS.map((i) => [i.id, i]));

/** What a new athlete turns up in, before they've bought anything. */
export const DEFAULT_LOADOUT: Loadout = {
  head: { item: "head.none" },
  eyes: { item: "eyes.none" },
  torso: { item: "torso.tee.magenta" },
  legs: { item: "legs.runshorts.black" },
  feet: { item: "feet.runshoes.white" },
  socks: { item: "socks.short.white" },
  watch: { item: "watch.none" },
};

/**
 * The kit a new athlete is given. These items are theirs; the same garment in
 * another colour is a different item and still has to be bought.
 */
export const STARTER_ITEMS: Set<string> = new Set(
  Object.values(DEFAULT_LOADOUT).map((w) => w.item),
);

/** Everything in a slot, cheapest first — the shape a shop shelf wants. */
export function rackFor(slot: Slot): AvatarItem[] {
  return AVATAR_ITEMS.filter((i) => i.slot === slot).sort((a, b) => a.price - b.price);
}


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
    paint(sheet.rows, sheet.res, sheet.x0, sheet.y0, item.colour, item.accent,
      view === "back", UPPER.has(slot));
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
