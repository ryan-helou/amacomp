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

export type Slot =
  | "banner" | "head" | "eyes" | "torso" | "hands" | "legs" | "feet" | "socks" | "watch";

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
  /**
   * Literal colours for sprites drawn in chars "1".."8" — flags, and anything
   * else whose colours are not the wearer's to choose. A Canadian flag in mint
   * is not a Canadian flag.
   */
  palette?: string[];
  /**
   * Skip the per-row lighting. Cloth hanging flat has no round surface to
   * shade, and the shading is what stops big flat areas merging into a handful
   * of rectangles — a union flag went from 212KB of markup to a fraction of it.
   */
  flat?: boolean;
}

/** What each athlete is wearing: one item per slot, and that's the whole of it. */
export interface Loadout {
  [slot: string]: { item: string };
}

type Sheet = { res: number; x0: number; y0: number; rows: string[] };
const DATA = sprites as unknown as {
  W: number; H: number; base: string[]; back: string[]; g: Record<string, Sheet>;
  flags: Record<string, { label: string; pal: string[]; sheet: Sheet }>;
};

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
  { id: "head.beanie.black", slot: "head", label: "Black beanie", price: 150, tier: "common", colour: BLACK, accent: WHITE, sprite: "beanie" },
  { id: "head.beanie.magenta", slot: "head", label: "Magenta beanie", price: 150, tier: "common", colour: MAGENTA, accent: WHITE, sprite: "beanie" },
  { id: "head.headband.mint", slot: "head", label: "Mint headband", price: 100, tier: "common", colour: MINT, accent: WHITE, sprite: "headband" },
  { id: "head.headband.magenta", slot: "head", label: "Magenta headband", price: 100, tier: "common", colour: MAGENTA, accent: WHITE, sprite: "headband" },
  { id: "head.visor.white", slot: "head", label: "White visor", price: 250, tier: "common", colour: WHITE, accent: BLACK, sprite: "visor" },
  { id: "head.visor.black", slot: "head", label: "Black visor", price: 250, tier: "common", colour: BLACK, accent: LIME, sprite: "visor" },

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
  { id: "torso.singlet.mint", slot: "torso", label: "Mint singlet", price: 300, tier: "common", colour: MINT, accent: WHITE, sprite: "singlet" },
  { id: "torso.singlet.magenta", slot: "torso", label: "Magenta singlet", price: 300, tier: "common", colour: MAGENTA, accent: WHITE, sprite: "singlet" },
  { id: "torso.singlet.white", slot: "torso", label: "White singlet", price: 300, tier: "common", colour: WHITE, accent: BLACK, sprite: "singlet" },
  { id: "torso.longsleeve.black", slot: "torso", label: "Black long sleeve", price: 450, tier: "common", colour: BLACK, accent: MINT, sprite: "longsleeve" },
  { id: "torso.longsleeve.cyan", slot: "torso", label: "Cyan long sleeve", price: 450, tier: "common", colour: CYAN, accent: WHITE, sprite: "longsleeve" },
  { id: "torso.jacket.orange", slot: "torso", label: "Orange rain jacket", price: 700, tier: "rare", colour: ORANGE, accent: BLACK, sprite: "jacket" },
  { id: "torso.jacket.black", slot: "torso", label: "Black rain jacket", price: 700, tier: "rare", colour: BLACK, accent: ORANGE, sprite: "jacket" },
  { id: "torso.wetsuit.black", slot: "torso", label: "Black wetsuit", price: 1100, tier: "epic", colour: BLACK, accent: CYAN, sprite: "wetsuit" },
  { id: "torso.wetsuit.cyan", slot: "torso", label: "Cyan wetsuit", price: 1100, tier: "epic", colour: "#0b3d52", accent: CYAN, sprite: "wetsuit" },

  { id: "legs.runshorts.black", slot: "legs", label: "Black running shorts", price: 0, tier: "common", colour: BLACK, accent: WHITE, sprite: "runshorts" },
  { id: "legs.runshorts.lime", slot: "legs", label: "Lime running shorts", price: 150, tier: "common", colour: LIME, accent: WHITE, sprite: "runshorts" },
  { id: "legs.bibs.black", slot: "legs", label: "Black bib shorts", price: 500, tier: "rare", colour: BLACK, accent: WHITE, sprite: "bibs" },
  { id: "legs.bibs.magenta", slot: "legs", label: "Magenta bib shorts", price: 500, tier: "rare", colour: MAGENTA, accent: WHITE, sprite: "bibs" },
  { id: "legs.jammers.black", slot: "legs", label: "Black jammers", price: 200, tier: "common", colour: BLACK, accent: WHITE, sprite: "jammers" },
  { id: "legs.jammers.cyan", slot: "legs", label: "Cyan jammers", price: 200, tier: "common", colour: CYAN, accent: WHITE, sprite: "jammers" },
  { id: "legs.tights.black", slot: "legs", label: "Black tights", price: 400, tier: "common", colour: BLACK, accent: MINT, sprite: "tights" },
  { id: "legs.tights.magenta", slot: "legs", label: "Magenta tights", price: 400, tier: "common", colour: MAGENTA, accent: WHITE, sprite: "tights" },
  { id: "legs.splitshorts.lime", slot: "legs", label: "Lime split shorts", price: 250, tier: "common", colour: LIME, accent: WHITE, sprite: "splitshorts" },
  { id: "legs.splitshorts.black", slot: "legs", label: "Black split shorts", price: 250, tier: "common", colour: BLACK, accent: LIME, sprite: "splitshorts" },

  { id: "feet.barefoot", slot: "feet", label: "Barefoot", price: 0, tier: "common", colour: SKIN_C, accent: WHITE, sprite: "barefoot" },
  { id: "feet.runshoes.white", slot: "feet", label: "White running shoes", price: 600, tier: "rare", colour: WHITE, accent: MAGENTA, sprite: "runshoes" },
  { id: "feet.runshoes.orange", slot: "feet", label: "Orange running shoes", price: 600, tier: "rare", colour: ORANGE, accent: WHITE, sprite: "runshoes" },
  { id: "feet.bikeshoes.white", slot: "feet", label: "White cycling shoes", price: 500, tier: "rare", colour: WHITE, accent: MAGENTA, sprite: "bikeshoes" },
  { id: "feet.bikeshoes.black", slot: "feet", label: "Black cycling shoes", price: 500, tier: "rare", colour: BLACK, accent: GOLD, sprite: "bikeshoes" },
  { id: "feet.carbon.gold", slot: "feet", label: "Gold carbon plate", price: 1500, tier: "legendary", colour: GOLD, accent: BLACK, sprite: "carbon" },
  { id: "feet.carbon.mint", slot: "feet", label: "Mint carbon plate", price: 1500, tier: "legendary", colour: MINT, accent: BLACK, sprite: "carbon" },
  { id: "feet.trail.lime", slot: "feet", label: "Lime trail shoes", price: 650, tier: "rare", colour: LIME, accent: BLACK, sprite: "trail" },
  { id: "feet.trail.black", slot: "feet", label: "Black trail shoes", price: 650, tier: "rare", colour: BLACK, accent: ORANGE, sprite: "trail" },
  { id: "feet.slides.cyan", slot: "feet", label: "Cyan recovery slides", price: 120, tier: "common", colour: CYAN, accent: WHITE, sprite: "slides" },
  { id: "feet.slides.magenta", slot: "feet", label: "Magenta recovery slides", price: 120, tier: "common", colour: MAGENTA, accent: WHITE, sprite: "slides" },

  { id: "socks.none", slot: "socks", label: "No socks", price: 0, tier: "common", colour: WHITE, accent: BLACK },
  { id: "socks.short.white", slot: "socks", label: "White short socks", price: 100, tier: "common", colour: WHITE, accent: BLACK, sprite: "socks_short" },
  { id: "socks.short.black", slot: "socks", label: "Black short socks", price: 100, tier: "common", colour: BLACK, accent: WHITE, sprite: "socks_short" },
  { id: "socks.tall.white", slot: "socks", label: "White tall socks", price: 150, tier: "common", colour: WHITE, accent: BLACK, sprite: "socks_tall" },
  { id: "socks.tall.magenta", slot: "socks", label: "Magenta tall socks", price: 150, tier: "common", colour: MAGENTA, accent: WHITE, sprite: "socks_tall" },
  { id: "socks.stripe.magenta", slot: "socks", label: "Magenta striped socks", price: 200, tier: "common", colour: WHITE, accent: MAGENTA, sprite: "socks_stripe" },
  { id: "socks.stripe.cyan", slot: "socks", label: "Cyan striped socks", price: 200, tier: "common", colour: WHITE, accent: CYAN, sprite: "socks_stripe" },

  { id: "hands.none", slot: "hands", label: "Bare hands", price: 0, tier: "common", colour: SKIN_C, accent: WHITE },
  { id: "hands.gloves.black", slot: "hands", label: "Black gloves", price: 300, tier: "common", colour: BLACK, accent: WHITE, sprite: "gloves" },
  { id: "hands.gloves.white", slot: "hands", label: "White gloves", price: 300, tier: "common", colour: WHITE, accent: BLACK, sprite: "gloves" },
  { id: "hands.armwarmers.black", slot: "hands", label: "Black arm warmers", price: 350, tier: "common", colour: BLACK, accent: MINT, sprite: "armwarmers" },
  { id: "hands.armwarmers.mint", slot: "hands", label: "Mint arm warmers", price: 350, tier: "common", colour: MINT, accent: BLACK, sprite: "armwarmers" },

  { id: "watch.none", slot: "watch", label: "No watch", price: 0, tier: "common", colour: BLACK, accent: MINT },
  { id: "watch.on.black", slot: "watch", label: "Black GPS watch", price: 300, tier: "common", colour: BLACK, accent: MINT, sprite: "watch" },
  { id: "watch.on.gold", slot: "watch", label: "Gold GPS watch", price: 450, tier: "rare", colour: GOLD, accent: BLACK, sprite: "watch" },
];

/**
 * The banner you fly behind you.
 *
 * Built from the generated flag data rather than listed by hand: scripts/
 * gen-avatar.py owns which countries exist and what they look like, so adding
 * one is four lines of Python and nothing here. Price follows the work in the
 * drawing — a tricolour is a tricolour; a union flag is not.
 */
/**
 * What a banner costs. Priced by hand rather than by how fussy the drawing is —
 * the first attempt counted painted pixels, which made every flag 800 because a
 * flag is a rectangle of paint whatever is on it.
 *
 * The two the league actually has a claim on are cheap: Canada because that's
 * where we are, Lebanon because that's where Ryan's from. Everything else is
 * 400, the ones with real work in them 600, and the house flag is the prize.
 */
const BANNER_PRICE: Record<string, number> = {
  ca: 250, lb: 250,
  gb: 600, us: 600, br: 600, za: 600, au: 600, mx: 600, ke: 600,
  ama: 2000,
};
const BANNER_TIER: Record<string, AvatarItem["tier"]> = { ama: "legendary" };

export const BANNER_ITEMS: AvatarItem[] = Object.entries(DATA.flags).map(([id, flag]) => {
  const price = BANNER_PRICE[id] ?? 400;
  return {
    id: `banner.${id}`,
    slot: "banner" as const,
    label: `${flag.label} banner`,
    price,
    tier: BANNER_TIER[id] ?? (price >= 600 ? "rare" : "common"),
    colour: flag.pal[0],
    accent: flag.pal[1] ?? flag.pal[0],
    flat: true,
    sprite: `flag.${id}`,
    palette: flag.pal,
  };
});

AVATAR_ITEMS.push(
  { id: "banner.none", slot: "banner", label: "No banner", price: 0, tier: "common", colour: "#20242b", accent: "#f3f3f1" },
  ...BANNER_ITEMS,
);

export const AVATAR_ITEM_BY_ID = new Map(AVATAR_ITEMS.map((i) => [i.id, i]));

/** What a new athlete turns up in, before they've bought anything. */
export const DEFAULT_LOADOUT: Loadout = {
  head: { item: "head.none" },
  hands: { item: "hands.none" },
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
// The banner is not in here: it is drawn before the body, above.
const ORDER: Slot[] = ["legs", "socks", "feet", "torso", "hands", "watch", "head", "eyes"];
// Worn on the chest, so these ride with the breath.
const UPPER: Set<Slot> = new Set(["head", "eyes", "torso", "hands", "watch"]);

/** Wardrobe sheets live in `g`; flags in `flags`, keyed "flag.<id>". */
function sheetFor(name: string): Sheet | undefined {
  if (name.startsWith("flag.")) return DATA.flags[name.slice(5)]?.sheet;
  return DATA.g[name];
}

/** What a banner hangs from. Steel, in every country. */
const RAIL = "#6b7280";

function shift(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255))
    .toString(16)
    .padStart(6, "0")}`;
}

/**
 * Which plane a layer sits in. "behind" is scenery — the banner hangs there,
 * so the figure stands in front of it; "upper" is everything that rides with
 * the breath; "lower" is planted. They are drawn in that order.
 */
type Zone = "behind" | "upper" | "lower";

type Layer = {
  grid: (string | null)[][]; res: number; x0: number; y0: number;
  w: number; h: number; zone: Zone;
};

/** One sprite sheet turned into a lit grid of pixels. */
function rasterise(
  rows: string[], res: number, x0: number, y0: number,
  colour: string, accent: string, mirror: boolean, zone: Zone,
  palette?: string[], flat = false,
): Layer {
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
        ch === "R" ? RAIL :
        // "1".."8" are an item's OWN colours — a flag's, not the wearer's.
        ch >= "1" && ch <= "8" ? palette?.[ch.charCodeAt(0) - 49] ?? colour :
        ch === "A" ? accent : colour;
    }
  }
  // Light from the upper left, proportional to this layer's density.
  const span = Math.max(1, Math.round(3 * res));
  if (flat) return { grid, res, x0: mirror ? DATA.W * res - (x0 + w) : x0, y0, w, h, zone };
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
  return { grid, res, x0: mirror ? DATA.W * res - (x0 + w) : x0, y0, w, h, zone };
}

/** A lit grid turned into SVG: outline first, then the colour runs. */
function draw(L: Layer): string {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= L.w || y >= L.h ? null : L.grid[y][x]);
  const u = 1 / L.res, ox = L.x0 / L.res, oy = L.y0 / L.res;

  // Row runs first: a horizontal stretch of one colour is one run.
  type Run = { x: number; len: number; colour: string | null };
  const rows: Run[][] = [];
  for (let y = 0; y < L.h; y++) {
    const runs: Run[] = [];
    let runStart = -1, runColour: string | null | undefined;
    const flush = (x: number) => {
      if (runStart >= 0) runs.push({ x: runStart, len: x - runStart, colour: runColour ?? null });
      runStart = -1; runColour = undefined;
    };
    for (let x = 0; x <= L.w; x++) {
      const c = x < L.w ? L.grid[y][x] : undefined;
      // undefined = nothing here; null = outline; a string = that colour.
      let paintAs: string | null | undefined;
      if (c) paintAs = c;
      else if (x < L.w && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) {
        paintAs = at(x + 1, y) && !at(x - 1, y) ? RIM : null;
      }
      if (paintAs !== runColour) {
        flush(x);
        if (paintAs !== undefined) { runStart = x; runColour = paintAs; }
      }
    }
    flush(L.w);
    rows.push(runs);
  }

  // Then down: a run repeated on the next row is the same rectangle, taller. A
  // torso is one rect this way rather than fifty, which is the difference
  // between a shop of forty boxes rendering and a phone giving up.
  let edges = "", cells = "";
  const open = new Map<string, { x: number; len: number; colour: string | null; y: number; h: number }>();
  const shut = (key: string) => {
    const r = open.get(key);
    if (!r) return;
    open.delete(key);
    const X = (ox + r.x * u).toFixed(3), Y = (oy + r.y * u).toFixed(3);
    const Wd = (r.len * u + u * 0.02).toFixed(3), Ht = (r.h * u + u * 0.02).toFixed(3);
    const rect = `<rect x="${X}" y="${Y}" width="${Wd}" height="${Ht}"`;
    if (r.colour) cells += `${rect} fill="${r.colour}"/>`;
    else edges += `${rect}/>`;
  };
  for (let y = 0; y <= L.h; y++) {
    const seen = new Set<string>();
    for (const run of rows[y] ?? []) {
      const key = `${run.x}:${run.len}:${run.colour}`;
      seen.add(key);
      const held = open.get(key);
      if (held) held.h++;
      else open.set(key, { ...run, y, h: 1 });
    }
    for (const key of [...open.keys()]) if (!seen.has(key)) shut(key);
  }
  for (const key of [...open.keys()]) shut(key);

  return `<g fill="${OUTLINE}">${edges}</g>${cells}`;
}

/**
 * One item on its own, drawn to its own bounds: the product photo for the shop.
 *
 * A shop box can't hold a whole figure — forty of those is megabytes of markup
 * and a phone that stutters. This is the single layer, cropped to the pixels it
 * actually fills, which is also what you want on a box: the thing itself, big.
 */
export function itemSvg(itemId: string): string {
  const item = AVATAR_ITEM_BY_ID.get(itemId);
  if (!item?.sprite) return "";
  const sheet = sheetFor(item.sprite);
  if (!sheet) return "";
  const L = rasterise(sheet.rows, sheet.res, sheet.x0, sheet.y0, item.colour, item.accent, false, "lower", item.palette, item.flat);

  // The drawn bounds, so a watch fills its box as well as a tri suit does.
  let minX = L.w, maxX = -1, minY = L.h, maxY = -1;
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) {
      if (!L.grid[y][x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return "";
  const u = 1 / L.res, pad = 1.5;
  const x = L.x0 / L.res + minX * u - pad;
  const y = L.y0 / L.res + minY * u - pad;
  const w = (maxX - minX + 1) * u + pad * 2;
  const h = (maxY - minY + 1) * u + pad * 2;
  return (
    `<svg viewBox="${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}" ` +
    `xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" ` +
    `aria-label="${item.label}">${draw(L)}</svg>`
  );
}

const IMAGES = new Map<string, string>();

/**
 * The same product photo as an image source, so a box costs one DOM node rather
 * than a few hundred rects. Cached: the catalogue never changes at runtime, and
 * a shelf of forty boxes should draw once.
 */
export function itemImage(itemId: string): string {
  const cached = IMAGES.get(itemId);
  if (cached !== undefined) return cached;
  const svg = itemSvg(itemId);
  const uri = svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : "";
  IMAGES.set(itemId, uri);
  return uri;
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
  const { W, H } = DATA;
  const src = view === "back" ? DATA.back : DATA.base;
  const headItem = AVATAR_ITEM_BY_ID.get(loadout.head?.item ?? "");

  const layers: Layer[] = [];

  const paint = (
    rows: string[], res: number, x0: number, y0: number,
    colour: string, accent: string, mirror: boolean, zone: Zone,
    palette?: string[], flat = false,
  ) => {
    layers.push(rasterise(rows, res, x0, y0, colour, accent, mirror, zone, palette, flat));
  };


  // The banner hangs BEHIND him, so it goes down before the body does — it is
  // scenery, not something worn, and it never breathes with the chest.
  const flown = loadout.banner ? AVATAR_ITEM_BY_ID.get(loadout.banner.item) : undefined;
  if (flown?.sprite) {
    const sheet = sheetFor(flown.sprite);
    // A flag is never mirrored: the back of the banner is the front of it.
    if (sheet) paint(sheet.rows, sheet.res, sheet.x0, sheet.y0, flown.colour, flown.accent,
      false, "behind", flown.palette, flown.flat);
  }

  const SPLIT = 86; // the hips: above it breathes, below it stays planted
  paint(src.slice(0, SPLIT), 1, 0, 0, SKIN, SKIN_D, false, "upper");
  paint(src.slice(SPLIT), 1, 0, SPLIT, SKIN, SKIN_D, false, "lower");

  for (const slot of ORDER) {
    const worn = loadout[slot];
    const item = worn ? AVATAR_ITEM_BY_ID.get(worn.item) : undefined;
    if (!item?.sprite) continue;
    if (slot === "eyes" && headItem?.coversEyes) continue;
    const sheet = sheetFor((view === "back" && item.spriteBack) || item.sprite);
    if (!sheet) continue;
    paint(sheet.rows, sheet.res, sheet.x0, sheet.y0, item.colour, item.accent,
      view === "back", UPPER.has(slot) ? "upper" : "lower", item.palette);
  }

  let behindOut = "", upperOut = "", lowerOut = "";
  for (const L of layers) {
    const chunk = draw(L);
    if (L.zone === "behind") behindOut += chunk;
    else if (L.zone === "upper") upperOut += chunk;
    else lowerOut += chunk;
  }

  const box = crop === "bust" ? "14 2 52 52" : `-1 0 ${W + 2} ${H}`;
  return (
    `<svg viewBox="${box}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" ` +
    `role="img" aria-label="Pixel avatar">${behindOut}<g class="avatar-breath">${upperOut}</g>${lowerOut}</svg>`
  );
}
