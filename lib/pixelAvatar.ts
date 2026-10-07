import sprites from "./avatar/sprites.json";
import { COUNTRY_FLAGS } from "./flags";

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
 * eyewear are three or four. Mixing is deliberate: small hard
 * objects need finer cells, and the same rules light them all.
 */

export type Slot =
  | "flag" | "skin" | "hair" | "face"
  | "head" | "eyes" | "torso" | "prize" | "legs" | "feet";

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
  /** Nothing to draw from behind: a shaved head is just a head. */
  hideBack?: boolean;
  /** A visor is the eyewear: it hides whatever is in the eyes slot. */
  coversEyes?: boolean;
  /** For a flag: which one, from lib/flags.ts. Drawn as a tag, not a sprite. */
  flag?: string;
  /**
   * A prize is not for sale. Where the price would go, the shop prints this —
   * "win a week" — because what it costs is a result, not coins.
   */
  earned?: string;
}

/** What each athlete is wearing: one item per slot, and that's the whole of it. */
export interface Loadout {
  [slot: string]: { item: string };
}

type Sheet = { res: number; x0: number; y0: number; rows: string[] };
const DATA = sprites as unknown as {
  W: number; H: number; base: string[]; back: string[]; g: Record<string, Sheet>;
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
  // You, rather than what you're wearing: free, because six athletes looking
  // like the same person in different kit was the thing worth fixing first.
  { id: "skin.light", slot: "skin", label: "Light", price: 0, tier: "common", colour: "#f0c9a6", accent: "#c9a07d" },
  { id: "skin.fair", slot: "skin", label: "Fair", price: 0, tier: "common", colour: "#dda077", accent: "#b2764f" },
  { id: "skin.olive", slot: "skin", label: "Olive", price: 0, tier: "common", colour: "#c98a55", accent: "#9c6334" },
  { id: "skin.tan", slot: "skin", label: "Tan", price: 0, tier: "common", colour: "#a96b3e", accent: "#7d4a26" },
  { id: "skin.brown", slot: "skin", label: "Brown", price: 0, tier: "common", colour: "#7c4a2a", accent: "#5a331b" },
  { id: "skin.deep", slot: "skin", label: "Deep", price: 0, tier: "common", colour: "#54301b", accent: "#3a2012" },

  { id: "hair.short.brown", slot: "hair", label: "Short brown", price: 0, tier: "common", colour: "#33241a", accent: WHITE, sprite: "hair_short", spriteBack: "hair_short_back" },
  { id: "hair.short.black", slot: "hair", label: "Short black", price: 0, tier: "common", colour: "#17120e", accent: WHITE, sprite: "hair_short", spriteBack: "hair_short_back" },
  { id: "hair.short.blonde", slot: "hair", label: "Short blonde", price: 0, tier: "common", colour: "#c8943f", accent: WHITE, sprite: "hair_short", spriteBack: "hair_short_back" },
  { id: "hair.buzz.black", slot: "hair", label: "Buzz cut", price: 0, tier: "common", colour: "#17120e", accent: WHITE, sprite: "hair_buzz", spriteBack: "hair_buzz_back" },
  { id: "hair.curly.black", slot: "hair", label: "Black curls", price: 0, tier: "common", colour: "#17120e", accent: WHITE, sprite: "hair_curly", spriteBack: "hair_curly_back" },
  { id: "hair.curly.brown", slot: "hair", label: "Brown curls", price: 0, tier: "common", colour: "#33241a", accent: WHITE, sprite: "hair_curly", spriteBack: "hair_curly_back" },
  { id: "hair.bun.black", slot: "hair", label: "Top knot", price: 0, tier: "common", colour: "#17120e", accent: WHITE, sprite: "hair_bun", spriteBack: "hair_bun_back" },
  { id: "hair.bald", slot: "hair", label: "Shaved", price: 0, tier: "common", colour: "#33241a", accent: WHITE },

  { id: "face.clean", slot: "face", label: "Clean shaven", price: 0, tier: "common", colour: "#33241a", accent: WHITE },
  { id: "face.stubble", hideBack: true, slot: "face", label: "Stubble", price: 0, tier: "common", colour: "#33241a", accent: WHITE, sprite: "beard_stubble" },
  { id: "face.beard", hideBack: true, slot: "face", label: "Beard", price: 0, tier: "common", colour: "#33241a", accent: WHITE, sprite: "beard_full" },
  { id: "face.moustache", hideBack: true, slot: "face", label: "Moustache", price: 0, tier: "common", colour: "#33241a", accent: WHITE, sprite: "moustache" },

  { id: "head.none", slot: "head", label: "Bare head", price: 0, tier: "common", colour: SKIN_C, accent: WHITE },
  { id: "head.helmet.magenta", slot: "head", label: "Magenta helmet", price: 400, tier: "rare", colour: MAGENTA, accent: WHITE, sprite: "helmet" },
  { id: "head.helmet.black", slot: "head", label: "Black helmet", price: 400, tier: "rare", colour: BLACK, accent: WHITE, sprite: "helmet" },
  { id: "head.swimcap.cyan", slot: "head", label: "Cyan swim cap", price: 150, tier: "common", colour: CYAN, accent: WHITE, sprite: "swimcap" },
  { id: "head.runcap.white", slot: "head", label: "White run cap", price: 200, tier: "common", colour: WHITE, accent: BLACK, sprite: "runcap" },
  // Orange-red visor, not gold — Ryan, 2026-10-07. The accent is the visor and
  // nothing else on this sprite, so this is the only thing it changes.
  { id: "head.aero.black", slot: "head", label: "Black aero helmet", price: 900, tier: "epic", colour: BLACK, accent: "#FF4A1C", sprite: "aero", spriteBack: "aero_back", coversEyes: true },
  { id: "head.aero.gold", slot: "head", label: "Gold aero helmet", price: 1200, tier: "legendary", colour: GOLD, accent: BLACK, sprite: "aero", spriteBack: "aero_back", coversEyes: true },
  { id: "head.beanie.black", slot: "head", label: "Black beanie", price: 150, tier: "common", colour: BLACK, accent: WHITE, sprite: "beanie" },
  { id: "head.visor.white", slot: "head", label: "White visor", price: 250, tier: "common", colour: WHITE, accent: BLACK, sprite: "visor" },
  { id: "head.kippa.navy", slot: "head", label: "Navy kippa", price: 150, tier: "common", colour: "#1F3A68", accent: WHITE, sprite: "kippa" },
  { id: "head.kippa.black", slot: "head", label: "Black kippa", price: 150, tier: "common", colour: BLACK, accent: "#3A3F49", sprite: "kippa" },
  { id: "head.kippa.white", slot: "head", label: "White kippa", price: 150, tier: "common", colour: WHITE, accent: "#1F3A68", sprite: "kippa" },

  { id: "eyes.none", slot: "eyes", label: "No eyewear", price: 0, tier: "common", colour: BLACK, accent: WHITE },
  { id: "eyes.shades.black", hideBack: true, slot: "eyes", label: "Black Ray-Bans", price: 400, tier: "rare", colour: BLACK, accent: "#39404b", sprite: "shades" },
  { id: "eyes.shades.tortoise", hideBack: true, slot: "eyes", label: "Tortoise Ray-Bans", price: 450, tier: "rare", colour: "#7a4a1e", accent: "#2b2119", sprite: "shades" },
  // A one-piece shield rather than two rimmed lenses, so it is its own sprite
  // and not the wayfarer in another colour.
  { id: "eyes.viper.black", hideBack: true, slot: "eyes", label: "Black Oakley Vipers", price: 550, tier: "epic", colour: BLACK, accent: "#8FD6E8", sprite: "viper" },
  { id: "eyes.viper.red", hideBack: true, slot: "eyes", label: "Red Oakley Vipers", price: 550, tier: "epic", colour: "#C8202C", accent: "#FFB23A", sprite: "viper" },

  { id: "torso.bare", slot: "torso", label: "Bare chest", price: 0, tier: "common", colour: SKIN_C, accent: WHITE },
  // The starter shirt. Free because everybody is given it; it is the one
  // garment nobody has to buy, and the thing a new man stands in on day one.
  { id: "torso.tee.black", slot: "torso", label: "Black running shirt", price: 0, tier: "common", colour: BLACK, accent: WHITE, sprite: "tee" },
  { id: "torso.tee.magenta", slot: "torso", label: "Magenta running shirt", price: 350, tier: "common", colour: MAGENTA, accent: WHITE, sprite: "tee" },
  { id: "torso.tee.white", slot: "torso", label: "White running shirt", price: 350, tier: "common", colour: WHITE, accent: BLACK, sprite: "tee" },
  { id: "torso.jersey.magenta", slot: "torso", label: "Magenta cycling jersey", price: 500, tier: "rare", colour: MAGENTA, accent: WHITE, sprite: "jersey" },
  { id: "torso.jersey.black", slot: "torso", label: "Black cycling jersey", price: 500, tier: "rare", colour: BLACK, accent: WHITE, sprite: "jersey" },
  { id: "torso.jersey.gold", slot: "torso", label: "Gold cycling jersey", price: 750, tier: "epic", colour: GOLD, accent: BLACK, sprite: "jersey" },
  { id: "torso.trisuit.black", slot: "torso", label: "Black tri suit", price: 900, tier: "epic", colour: BLACK, accent: GOLD, sprite: "trisuit" },
  { id: "torso.trisuit.cyan", slot: "torso", label: "Cyan tri suit", price: 900, tier: "epic", colour: CYAN, accent: WHITE, sprite: "trisuit" },
  // Full-length, all black: the panels and zip are a charcoal you have to look
  // for, so it reads black from across the Board. Ryan, 2026-10-07.
  { id: "torso.trisuit.long", slot: "torso", label: "Black long tri suit", price: 600, tier: "epic", colour: BLACK, accent: "#2A2E36", sprite: "trisuit_long" },
  { id: "torso.singlet.magenta", slot: "torso", label: "Magenta singlet", price: 300, tier: "common", colour: MAGENTA, accent: WHITE, sprite: "singlet" },
  { id: "torso.singlet.white", slot: "torso", label: "White singlet", price: 300, tier: "common", colour: WHITE, accent: BLACK, sprite: "singlet" },
  { id: "torso.longsleeve.black", slot: "torso", label: "Black long sleeve", price: 450, tier: "common", colour: BLACK, accent: MINT, sprite: "longsleeve" },
  { id: "torso.jacket.orange", slot: "torso", label: "Orange rain jacket", price: 700, tier: "rare", colour: ORANGE, accent: BLACK, sprite: "jacket" },
  { id: "torso.wetsuit.black", slot: "torso", label: "Black wetsuit", price: 1100, tier: "epic", colour: BLACK, accent: CYAN, sprite: "wetsuit" },

  // One pair of shorts in five colours, Ryan's call. The bibs, the jammers
  // and the tights were four lengths of the same box, and at the size a row
  // draws a figure nothing told them apart but the hem.
  { id: "legs.shorts.black", slot: "legs", label: "Black shorts", price: 0, tier: "common", colour: BLACK, accent: WHITE, sprite: "shorts" },
  { id: "legs.shorts.white", slot: "legs", label: "White shorts", price: 150, tier: "common", colour: WHITE, accent: BLACK, sprite: "shorts" },
  { id: "legs.shorts.lime", slot: "legs", label: "Lime shorts", price: 150, tier: "common", colour: LIME, accent: WHITE, sprite: "shorts" },
  { id: "legs.shorts.magenta", slot: "legs", label: "Magenta shorts", price: 150, tier: "common", colour: MAGENTA, accent: WHITE, sprite: "shorts" },
  { id: "legs.shorts.cyan", slot: "legs", label: "Cyan shorts", price: 150, tier: "common", colour: CYAN, accent: WHITE, sprite: "shorts" },
  { id: "legs.shorts.gold", slot: "legs", label: "Gold shorts", price: 400, tier: "rare", colour: GOLD, accent: BLACK, sprite: "shorts" },

  { id: "feet.barefoot", slot: "feet", label: "Barefoot", price: 0, tier: "common", colour: SKIN_C, accent: WHITE, sprite: "barefoot" },
  { id: "feet.runshoes.white", slot: "feet", label: "White running shoes", price: 600, tier: "rare", colour: WHITE, accent: MAGENTA, sprite: "runshoes" },
  { id: "feet.runshoes.orange", slot: "feet", label: "Orange running shoes", price: 600, tier: "rare", colour: ORANGE, accent: WHITE, sprite: "runshoes" },
  { id: "feet.bikeshoes.black", slot: "feet", label: "Black cycling shoes", price: 500, tier: "rare", colour: BLACK, accent: GOLD, sprite: "bikeshoes" },
  { id: "feet.carbon.gold", slot: "feet", label: "Gold carbon plate", price: 1500, tier: "legendary", colour: GOLD, accent: BLACK, sprite: "carbon" },
  { id: "feet.carbon.mint", slot: "feet", label: "Mint carbon plate", price: 1500, tier: "legendary", colour: MINT, accent: BLACK, sprite: "carbon" },
  { id: "feet.trail.lime", slot: "feet", label: "Lime trail shoes", price: 650, tier: "rare", colour: LIME, accent: BLACK, sprite: "trail" },
  { id: "feet.slides.cyan", slot: "feet", label: "Cyan recovery slides", price: 120, tier: "common", colour: CYAN, accent: WHITE, sprite: "slides" },

  { id: "head.bucket.olive", slot: "head", label: "Olive bucket hat", price: 250, tier: "common", colour: "#4D6A3A", accent: "#2F4423", sprite: "bucket" },
  { id: "head.bucket.black", slot: "head", label: "Black bucket hat", price: 250, tier: "common", colour: BLACK, accent: "#3A3F49", sprite: "bucket" },
  { id: "head.cowboy.tan", slot: "head", label: "Cowboy hat", price: 600, tier: "rare", colour: "#6B4A2A", accent: "#3D2A17", sprite: "cowboy" },
  { id: "head.santa", slot: "head", label: "Santa hat", price: 400, tier: "rare", colour: "#C6202C", accent: WHITE, sprite: "santa" },
  { id: "head.durag.black", slot: "head", label: "Black durag", price: 300, tier: "common", colour: "#17120E", accent: "#33241A", sprite: "durag", spriteBack: "durag_back" },
  { id: "head.durag.magenta", slot: "head", label: "Magenta durag", price: 300, tier: "common", colour: MAGENTA, accent: "#8F0C54", sprite: "durag", spriteBack: "durag_back" },
  { id: "eyes.ski.orange", slot: "eyes", label: "Orange ski goggles", price: 500, tier: "rare", colour: "#2A2F38", accent: "#FF7A29", sprite: "skigoggles" },
  { id: "eyes.ski.mirror", slot: "eyes", label: "Mirrored ski goggles", price: 650, tier: "epic", colour: BLACK, accent: "#8FD6E8", sprite: "skigoggles" },
  { id: "torso.polo.green", slot: "torso", label: "Club polo", price: 500, tier: "common", colour: "#15493A", accent: WHITE, sprite: "polo" },
  { id: "torso.polo.white", slot: "torso", label: "White club polo", price: 500, tier: "common", colour: WHITE, accent: "#15493A", sprite: "polo" },
  // Philadelphia's blue and red, and the Lakers' purple and gold, each with
  // the 23 on the chest. Named the way Ryan asked for them; the drawing
  // itself is colours and a number, no badge or wordmark.
  //
  // Vest AND shorts in one item, Ryan's call 2026-10-02: "only sell the kit
  // together". It sits in the torso slot and carries on past the waist, the
  // way the tri suit does — so whatever shorts you own, the kit covers them.
  { id: "torso.hoops.phi", slot: "torso", label: "LeBron Philly kit", price: 1300, tier: "epic", colour: "#006BB6", accent: "#ED174C", sprite: "basketball" },
  { id: "torso.hoops.gold", slot: "torso", label: "LeBron Lakers kit", price: 1500, tier: "epic", colour: "#552583", accent: "#FDB927", sprite: "basketball" },
  { id: "torso.dungarees", slot: "torso", label: "Dungarees", price: 700, tier: "rare", colour: "#3B5A86", accent: "#D9B46A", sprite: "dungarees" },
  { id: "torso.gi", slot: "torso", label: "Gi", price: 800, tier: "rare", colour: "#F2F0EA", accent: "#1A1A1A", sprite: "gi" },
  { id: "prize.none", slot: "prize", label: "No prize", price: 0, tier: "common", colour: GOLD, accent: WHITE },
  { id: "prize.medal", slot: "prize", label: "Week winner's medal", price: 0, tier: "epic", colour: GOLD, accent: "#b23a48", sprite: "medal", hideBack: true, earned: "win a week" },
  { id: "prize.sash", slot: "prize", label: "Month winner's sash", price: 0, tier: "epic", colour: "#b23a48", accent: GOLD, sprite: "sash", earned: "win a month" },
  { id: "prize.crown", slot: "prize", label: "Champion's crown", price: 0, tier: "legendary", colour: GOLD, accent: "#b23a48", sprite: "crown", earned: "win the season" },
  // Second and third are the same circlet in their own metal. A podium is
  // told apart by what it is made of, so that is all that changes.
  { id: "prize.silver", slot: "prize", label: "Runner-up's circlet", price: 0, tier: "epic", colour: "#c4ccd4", accent: "#7d8795", sprite: "circlet", earned: "finish the season second" },
  { id: "prize.bronze", slot: "prize", label: "Third place circlet", price: 0, tier: "epic", colour: "#a8692f", accent: "#6d421c", sprite: "circlet", earned: "finish the season third" },

];

/**
 * The flags, built from lib/flags.ts so the country list lives in one place.
 * They carry no sprite: a flag is drawn as a tag beside the figure, the way an
 * away week's flag is drawn on the Board.
 */
export const FLAG_ITEMS: AvatarItem[] = COUNTRY_FLAGS.map((f) => ({
  id: `flag.${f.id}`,
  slot: "flag" as const,
  label: f.label,
  // One purchase, two places it shows: the tag by your name and the lane
  // behind your row.
  price: f.price ?? (f.id === "ama" ? 1500 : 400),
  tier: f.id === "ama" ? "legendary" : "rare",
  colour: f.bands[0],
  accent: f.bands[1] ?? f.bands[0],
  flag: f.id,
}));

AVATAR_ITEMS.push(
  { id: "flag.none", slot: "flag", label: "No flag", price: 0, tier: "common", colour: "#20242b", accent: "#f3f3f1" },
  ...FLAG_ITEMS,
);

export const AVATAR_ITEM_BY_ID = new Map(AVATAR_ITEMS.map((i) => [i.id, i]));

/** What a new athlete turns up in, before they've bought anything. */
export const DEFAULT_LOADOUT: Loadout = {
  flag: { item: "flag.none" },
  skin: { item: "skin.fair" },
  hair: { item: "hair.short.brown" },
  face: { item: "face.clean" },
  head: { item: "head.none" },
  eyes: { item: "eyes.none" },
  torso: { item: "torso.tee.black" },
  legs: { item: "legs.shorts.black" },
  feet: { item: "feet.runshoes.white" },
  prize: { item: "prize.none" },
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

/**
 * The champion's gilding: the same figure, drawn with a gold edge instead of
 * the near-black one.
 *
 * Not an item, deliberately. A champion keeps every single thing he chose to
 * wear — the crown already costs him his hat, and taking the shirt as well
 * would mean the better you do the less of your own figure is left. An
 * outline takes nothing: it is the one mark that can be applied to a man who
 * is already fully dressed. It is also the only one that survives the crop to
 * a 36px bust, which is where most of the app actually sees a figure.
 */
const GILT = "#b88518";
const GILT_RIM = "#f0c64b";

// Legs first, eyewear last: the order things are put on.
// A crown goes on over the hair and over the helmet, so the prize is the last
// thing drawn. Nothing else in the slot reaches anything that comes before it.
const ORDER: Slot[] = ["legs", "feet", "torso", "hair", "face", "head", "eyes", "prize"];
// Worn on the chest, so these ride with the breath.
const UPPER: Set<Slot> = new Set(["head", "eyes", "torso", "prize", "hair", "face"]);

function shift(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255))
    .toString(16)
    .padStart(6, "0")}`;
}

/**
 * Which plane a layer sits in: "upper" rides with the breath, "lower" stays
 * planted. Drawn in that order.
 */
type Zone = "upper" | "lower";

type Layer = {
  grid: (string | null)[][]; res: number; x0: number; y0: number;
  w: number; h: number; zone: Zone;
};

/** One sprite sheet turned into a lit grid of pixels. */
function rasterise(
  rows: string[], res: number, x0: number, y0: number,
  colour: string, accent: string, mirror: boolean, zone: Zone,
  tone?: { skin: string; shade: string },
): Layer {
  const w = rows[0].length, h = rows.length;
  const grid: (string | null)[][] = Array.from({ length: h }, () => new Array(w).fill(null));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === ".") continue;
      const sx = mirror ? w - 1 - x : x;
      grid[y][sx] =
        ch === "S" ? tone?.skin ?? SKIN : ch === "D" ? tone?.shade ?? SKIN_D : ch === "H" ? HAIR :
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
        // The shaded edge runs dark at the rim and back to normal inside. In
        // STEPS, not per cell: a per-cell ramp gave a fine sprite twelve
        // distinct shades in a row, so no two rows ever merged (the aero
        // helmet alone was 2,262 rectangles), and its inner end came out at
        // 1.49x — brighter than the colour it was shading.
        const steps = 4;
        for (let k = 0; k < span; k++) {
          const t = span === 1 ? 1 : k / (span - 1);
          const q = Math.round(t * (steps - 1)) / (steps - 1);
          grid[y][end - k] = shift(c, 0.72 + 0.28 * q);
        }
      } else if (len >= Math.max(2, Math.round(1.5 * res))) {
        grid[y][end] = shift(c, 0.8);
      }
      x = end + 1;
    }
  }
  return { grid, res, x0: mirror ? DATA.W * res - (x0 + w) : x0, y0, w, h, zone };
}

/** A lit grid turned into SVG: outline first, then the colour runs. */
function draw(L: Layer, ink = OUTLINE, rim = RIM): string {
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
        paintAs = at(x + 1, y) && !at(x - 1, y) ? rim : null;
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

  return `<g fill="${ink}">${edges}</g>${cells}`;
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
  const sheet = DATA.g[item.sprite];
  if (!sheet) return "";
  const L = rasterise(sheet.rows, sheet.res, sheet.x0, sheet.y0, item.colour, item.accent, false, "lower");

  // The drawn bounds, so a sock fills its box as well as a tri suit does.
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

const BODY_CACHE = new Map<string, { upper: string; lower: string }>();

/** The bare figure's two halves, drawn once per view and remembered. */
/**
 * The seam between the two zones, at the hips: above it the drawing rides the
 * breath animation, below it stays planted.
 */
const ZONE_SPLIT = 86;

function bodyChunks(
  view: "front" | "back", src: string[], bustOnly: boolean, skin: string, shade: string,
  gilded = false,
): { upper: string; lower: string } {
  // The gilding changes the markup, so it has to be part of the cache key —
  // without it the first figure drawn decides the edge colour of every figure
  // that shares a skin tone for the rest of the session.
  const key = `${view}${bustOnly ? ":bust" : ""}:${skin}${gilded ? ":gilt" : ""}`;
  const held = BODY_CACHE.get(key);
  if (held) return held;
  const SPLIT = ZONE_SPLIT;
  const tone = { skin, shade };
  const ink = gilded ? GILT : OUTLINE, rim = gilded ? GILT_RIM : RIM;
  const made = {
    upper: draw(rasterise(src.slice(0, SPLIT), 1, 0, 0, skin, shade, false, "upper", tone), ink, rim),
    lower: bustOnly
      ? ""
      : draw(rasterise(src.slice(SPLIT), 1, 0, SPLIT, skin, shade, false, "lower", tone), ink, rim),
  };
  BODY_CACHE.set(key, made);
  return made;
}

/**
 * The figure as an SVG string.
 *
 * `crop` picks the framing: the whole figure, or head and shoulders for the
 * 36px bust that sits in the Board's lanes — the same drawing either way.
 */
export function avatarSvg(
  loadout: Loadout,
  { view = "front", crop = "full", gilded = false }: {
    view?: "front" | "back";
    crop?: "full" | "bust";
    /** The reigning champion, drawn with a gold edge. See GILT. */
    gilded?: boolean;
  } = {},
): string {
  const { W, H } = DATA;
  const src = view === "back" ? DATA.back : DATA.base;
  const headItem = AVATAR_ITEM_BY_ID.get(loadout.head?.item ?? "");
  // Skin is read before anything is painted: an item's own bare-skin pixels
  // (the foot inside a sandal) have to match the body they belong to.
  const tone = AVATAR_ITEM_BY_ID.get(loadout.skin?.item ?? "") ?? AVATAR_ITEM_BY_ID.get("skin.fair")!;

  const layers: Layer[] = [];

  const paint = (
    rows: string[], res: number, x0: number, y0: number,
    colour: string, accent: string, mirror: boolean, zone: Zone,
  ) => {
    layers.push(rasterise(rows, res, x0, y0, colour, accent, mirror, zone,
      { skin: tone.colour, shade: tone.accent }));
  };


  /**
   * A bust is a 36px window onto the head. Drawing his shoes into it cost
   * 156KB of markup for a circle you could cover with a thumbnail, so the
   * layers that cannot appear in the window are skipped. It is still the SAME
   * drawing — every rectangle it emits is one the full figure emits too, which
   * is what the test checks.
   */
  const IN_BUST: Set<Slot> = new Set(["torso", "prize", "head", "eyes", "hair", "face"]);
  const wanted = (slot: Slot) => crop !== "bust" || IN_BUST.has(slot);

  const body = bodyChunks(view, src, crop === "bust", tone.colour, tone.accent, gilded);

  // Brows ride with whatever hair you chose, in its colour — they belong to
  // the face, not to any one hairstyle.
  const mane = AVATAR_ITEM_BY_ID.get(loadout.hair?.item ?? "");
  if (mane && view === "front") {
    const brows = DATA.g["brows"];
    if (brows) paint(brows.rows, brows.res, brows.x0, brows.y0, mane.colour, mane.accent, false, "upper");
  }

  for (const slot of ORDER) {
    if (!wanted(slot)) continue;
    const worn = loadout[slot];
    const item = worn ? AVATAR_ITEM_BY_ID.get(worn.item) : undefined;
    if (!item?.sprite) continue;
    if (slot === "eyes" && headItem?.coversEyes) continue;
    if (view === "back" && item.hideBack) continue;
    const sheet = DATA.g[(view === "back" && item.spriteBack) || item.sprite];
    if (!sheet) continue;
    const zone: Zone = UPPER.has(slot) ? "upper" : "lower";
    // A tri suit and a wetsuit are one piece: they carry on past the hips,
    // which is below the seam. Painting the whole sheet in the upper zone put
    // those legs inside the breathing group, and the lower zone is emitted
    // after it — so a pair of shorts painted straight over them and the suit
    // stopped at the waist. Split the sheet at the seam and each half lands in
    // its own zone, in catalogue order, where it belongs.
    const cut = Math.ceil(ZONE_SPLIT * sheet.res) - sheet.y0;
    if (zone === "upper" && cut > 0 && cut < sheet.rows.length) {
      paint(sheet.rows.slice(0, cut), sheet.res, sheet.x0, sheet.y0, item.colour,
        item.accent, view === "back", "upper");
      paint(sheet.rows.slice(cut), sheet.res, sheet.x0, sheet.y0 + cut, item.colour,
        item.accent, view === "back", "lower");
      continue;
    }
    paint(sheet.rows, sheet.res, sheet.x0, sheet.y0, item.colour, item.accent,
      view === "back", zone);
  }

  let upperOut = body.upper, lowerOut = body.lower;
  const ink = gilded ? GILT : OUTLINE, rim = gilded ? GILT_RIM : RIM;
  for (const L of layers) {
    const chunk = draw(L, ink, rim);
    if (L.zone === "upper") upperOut += chunk;
    else lowerOut += chunk;
  }

  const box = crop === "bust" ? "14 2 52 52" : `-1 0 ${W + 2} ${H}`;
  return (
    `<svg viewBox="${box}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" ` +
    `role="img" aria-label="Pixel avatar"><g class="avatar-breath">${upperOut}</g>${lowerOut}</svg>`
  );
}

/**
 * A look for an athlete who has never opened the Club.
 *
 * Derived from the name and nothing else, so it is the same figure on every
 * device, on every render, and after every deploy — an avatar that reshuffles
 * itself is not a character, it's noise. Two names never land on the same
 * figure by accident either, because the name is hashed whole: `Jona` and
 * `Jonah` are different athletes and must not come out as the same person.
 *
 * It draws only from the COMMON shelf. If you see someone in a gold jersey or
 * an aero helmet, they bought it — that is the whole point of the shop, and a
 * generated look that helps itself to the legendary rack would empty it of
 * meaning. The one exception is shoes: a board full of runners standing
 * barefoot reads as a bug rather than as people who haven't been shopping, so
 * the generated figure gets a plain pair.
 */
export function loadoutFor(name: string): Loadout {
  // FNV-1a over the whole name, then a different slice of it per slot.
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const pick = <T,>(pool: readonly T[], salt: number): T =>
    pool[(Math.imul(h ^ (salt * 0x9e3779b1), 0x85ebca6b) >>> 8) % pool.length];

  const commons = (slot: Slot) =>
    AVATAR_ITEMS.filter((i) => i.slot === slot && i.tier === "common" && !!i.sprite);

  // Only the free slots vary. Ryan, 2026-10-05: "No one should have any
  // items. Only a black shirt and black shorts and whatever trophies you
  // earned." The hash used to dress a new man in whatever common kit it
  // landed on — a 450-coin long sleeve, 600-coin shoes — which he did not own
  // and could not re-select once he took it off. A man's face is who he is;
  // his kit is what he bought.
  const free = (slot: Slot) => commons(slot).filter((i) => i.price === 0);
  return {
    ...DEFAULT_LOADOUT,
    skin: { item: pick(AVATAR_ITEMS.filter((i) => i.slot === "skin"), 1).id },
    hair: { item: pick(free("hair"), 2).id },
    face: { item: pick(free("face"), 3).id },
  };
}

/**
 * What to draw for an athlete: what they saved, or a look from their name.
 *
 * Every screen that shows a figure goes through here, so a saved avatar and a
 * generated one are never a different code path — the Board cannot end up
 * drawing one athlete and a blank for the next.
 */
export function lookFor(
  athlete: { id: string; name: string },
  saved: Record<string, Record<string, { item: string }>> | undefined,
): Loadout {
  // The saved choices go ON TOP of the generated look, never instead of it.
  //
  // A saved loadout is often PARTIAL: the till drops anything you haven't
  // bought when you save (lib/../api/club), so a save can come back holding
  // four slots out of eleven. Returned as-is that is not a person in some
  // clothes — it is a person with no torso, no legs and no shoes, because a
  // missing slot draws nothing at all. Ryan's own figure was bare on the board
  // for exactly this reason. What he chose still wins every slot he chose.
  return { ...loadoutFor(athlete.name), ...(saved?.[athlete.id] ?? {}) };
}
