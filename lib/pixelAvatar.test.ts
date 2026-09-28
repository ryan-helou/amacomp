import {
  AVATAR_ITEMS, AVATAR_ITEM_BY_ID, DEFAULT_LOADOUT, STARTER_ITEMS,
  avatarSvg, rackFor, type Loadout,
} from "./pixelAvatar";
import sprites from "./avatar/sprites.json";

/**
 * The avatar is generated art, so the thing worth testing is the wiring: every
 * item the shop lists must exist in the sprite sheet, the figure must render,
 * and the bust must be the SAME drawing as the full figure — the moment those
 * drift, someone's paid-for helmet stops appearing on the Board.
 */

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`);
  }
}

const data = sprites as unknown as { g: Record<string, unknown> };

console.log("\nevery item the shop sells can be drawn");
{
  const missing = AVATAR_ITEMS.filter((i) => i.sprite && !data.g[i.sprite]).map((i) => i.id);
  check("no item points at a sprite that isn't there", missing, []);
  const missingBack = AVATAR_ITEMS.filter((i) => i.spriteBack && !data.g[i.spriteBack]).map((i) => i.id);
  check("and the same for the back views", missingBack, []);
  check("ids are unique", AVATAR_ITEM_BY_ID.size, AVATAR_ITEMS.length);
  // A priced item that nobody can wear is a bug in the catalogue.
  const paidWithoutArt = AVATAR_ITEMS.filter((i) => i.price > 0 && !i.sprite).map((i) => i.id);
  check("nothing is sold without art", paidWithoutArt, []);
}

console.log("\nthe figure renders");
{
  const svg = avatarSvg(DEFAULT_LOADOUT);
  check("it's an svg", svg.startsWith("<svg"), true);
  check("with something drawn in it", svg.includes("<rect"), true);
  check("and a breathing group", svg.includes("avatar-breath"), true);
  const bust = avatarSvg(DEFAULT_LOADOUT, { crop: "bust" });
  // Same drawing, different window onto it: the bust must not be a second sprite.
  check("the bust crops rather than redraws",
    bust.replace(/viewBox="[^"]+"/, "") === svg.replace(/viewBox="[^"]+"/, ""), true);
}

console.log("\nwhat you wear changes what is drawn");
{
  const bare: Loadout = { ...DEFAULT_LOADOUT, head: { item: "head.none" } };
  const lid: Loadout = { ...DEFAULT_LOADOUT, head: { item: "head.helmet.magenta" } };
  check("a helmet adds pixels", avatarSvg(lid).length > avatarSvg(bare).length, true);

  // The aero helmet brings its own visor, so shades under it must not draw.
  const aeroAndShades: Loadout = {
    ...DEFAULT_LOADOUT,
    head: { item: "head.aero.black" },
    eyes: { item: "eyes.shades.black" },
  };
  const aeroAlone: Loadout = { ...aeroAndShades, eyes: { item: "eyes.none" } };
  check("a visor hides the shades under it", avatarSvg(aeroAndShades) === avatarSvg(aeroAlone), true);

  // And only the aero has a second drawing; everything else mirrors.
  const back = avatarSvg(aeroAlone, { view: "back" });
  check("the back view is its own drawing", back !== avatarSvg(aeroAlone), true);
}

console.log("\na colour is a different item, not a setting on one");
{
  // Ryan's rule: you don't buy a jersey and then its colours — the magenta
  // jersey and the black jersey are two items on the shelf.
  const jerseys = AVATAR_ITEMS.filter((i) => i.id.startsWith("torso.jersey."));
  check("the jersey is on the shelf more than once", jerseys.length > 1, true);
  check("each one is priced on its own", jerseys.every((j) => j.price > 0), true);
  check("and they share the one drawing", new Set(jerseys.map((j) => j.sprite)).size, 1);

  // Two items, two figures. If they drew the same, the second is not a thing
  // worth owning.
  const drawn = new Set(
    jerseys.map((j) => avatarSvg({ ...DEFAULT_LOADOUT, torso: { item: j.id } })),
  );
  check("wearing each draws a different figure", drawn.size, jerseys.length);

  // Nothing in a loadout can name a colour: there is no field for one.
  const keys = new Set(Object.values(DEFAULT_LOADOUT).flatMap((w) => Object.keys(w)));
  check("a loadout says what you wear and nothing else", [...keys], ["item"]);

  // The starter kit is items, so the same shirt in another colour still costs.
  check("the starter shirt is yours", STARTER_ITEMS.has("torso.tee.magenta"), true);
  check("the same shirt in mint is not", STARTER_ITEMS.has("torso.tee.mint"), false);
  check("and it has a price", AVATAR_ITEM_BY_ID.get("torso.tee.mint")!.price > 0, true);
}

console.log("\nthe rack is shoppable");
{
  const ids = AVATAR_ITEMS.map((i) => i.id);
  check("every item id is unique", ids.length, new Set(ids).size);
  const labels = AVATAR_ITEMS.map((i) => i.label);
  check("and every label is too", labels.length, new Set(labels).size);
  // Cheapest first, so a shelf reads the way a shelf should.
  const prices = rackFor("torso").map((i) => i.price);
  check("a rack comes out cheapest first", prices, [...prices].sort((a, b) => a - b));
  // Every slot has something free to fall back on.
  const slots = [...new Set(AVATAR_ITEMS.map((i) => i.slot))];
  check("no slot can leave you with nothing to wear",
    slots.every((s) => rackFor(s).some((i) => i.price === 0)), true);
}

console.log(failures === 0 ? "\nAll avatar tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
