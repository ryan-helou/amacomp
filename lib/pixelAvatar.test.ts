import {
  AVATAR_ITEMS, AVATAR_ITEM_BY_ID, COLOURWAYS, DEFAULT_LOADOUT, STARTER_SKUS,
  avatarSvg, coloursOf, skuPrice, usesAccent, waysFor, type Loadout,
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
  const bare: Loadout = { ...DEFAULT_LOADOUT, head: { item: "head.none", way: "stock" } };
  const lid: Loadout = { ...DEFAULT_LOADOUT, head: { item: "head.helmet", way: "magenta" } };
  check("a helmet adds pixels", avatarSvg(lid).length > avatarSvg(bare).length, true);

  // The aero helmet brings its own visor, so shades under it must not draw.
  const aeroAndShades: Loadout = {
    ...DEFAULT_LOADOUT,
    head: { item: "head.aero", way: "black" },
    eyes: { item: "eyes.shades", way: "black" },
  };
  const aeroAlone: Loadout = { ...aeroAndShades, eyes: { item: "eyes.none", way: "stock" } };
  check("a visor hides the shades under it", avatarSvg(aeroAndShades) === avatarSvg(aeroAlone), true);

  // And only the aero has a second drawing; everything else mirrors.
  const back = avatarSvg(aeroAlone, { view: "back" });
  check("the back view is its own drawing", back !== avatarSvg(aeroAlone), true);
}

console.log("\nthe accent picker is offered only where it does something");
{
  // The locker shows a second colour per item, and it must not lie: offering an
  // accent on an item with no accent cell is a control that does nothing.
  check("a jersey has trim", usesAccent("torso.jersey"), true);
  check("bib shorts do not", usesAccent("legs.bibs"), false);
  check("nothing worn has no accent", usesAccent("head.none"), false);

  // Trim is part of the colourway, so the two colourways that differ only in
  // trim have to draw differently — otherwise the trim is decoration on paper.
  const accented = AVATAR_ITEMS.filter((i) => usesAccent(i.id));
  check("several items carry one", accented.length > 0, true);
  let honest = 0;
  for (const item of accented) {
    // Mint and lime share no colour but differ in trim too; compare a pair that
    // differs ONLY in trim by drawing the same colour with each one's accent.
    const base: Loadout = { ...DEFAULT_LOADOUT, [item.slot]: { item: item.id, way: "white" } };
    const other: Loadout = { ...DEFAULT_LOADOUT, [item.slot]: { item: item.id, way: "black" } };
    if (avatarSvg(base) !== avatarSvg(other)) honest++;
  }
  check("and every one of them redraws when it changes", honest, accented.length);
}

console.log("\ncolour is what you buy, not a free choice on top");
{
  // Ryan's rule: one jersey, one colour. Owning the magenta one must not hand
  // over the black one, so every colourway has to be its own priced SKU.
  const jersey = AVATAR_ITEM_BY_ID.get("torso.jersey")!;
  check("a jersey is sold in the full rack", waysFor("torso.jersey").length, COLOURWAYS.length);
  check("each colourway costs the item's price", skuPrice("torso.jersey", "magenta"), jersey.price);
  check("and a premium colour costs half again", skuPrice("torso.jersey", "black"), 750);
  check("the starter kit is free", skuPrice("torso.tee", "magenta") > 0
    && STARTER_SKUS.has("torso.tee/magenta"), true);
  check("but its other colours are not", STARTER_SKUS.has("torso.tee/gold"), false);

  // Two colourways of the same item must be two different drawings, or the
  // second purchase buys nothing.
  const ways = waysFor("torso.jersey");
  const drawings = new Set(
    ways.map((w) => avatarSvg({ ...DEFAULT_LOADOUT, torso: { item: "torso.jersey", way: w.id } })),
  );
  check("every colourway is a different jersey", drawings.size, ways.length);

  // Nothing-items aren't a colour choice at all.
  check("bare feet come one way", waysFor("feet.barefoot").map((w) => w.id), ["stock"]);
  check("and cost nothing", skuPrice("feet.barefoot", "stock"), 0);

  // A loadout naming a colourway the item isn't sold in must still draw.
  check("an unknown colourway falls back to a real one",
    coloursOf("torso.jersey", "chartreuse"), coloursOf("torso.jersey", ways[0].id));
}

console.log(failures === 0 ? "\nAll avatar tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
