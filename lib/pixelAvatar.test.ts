import { AVATAR_ITEMS, AVATAR_ITEM_BY_ID, DEFAULT_LOADOUT, avatarSvg, type Loadout } from "./pixelAvatar";
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
  const bare: Loadout = { ...DEFAULT_LOADOUT, head: { item: "head.none", colour: "#d4147e" } };
  const lid: Loadout = { ...DEFAULT_LOADOUT, head: { item: "head.helmet", colour: "#d4147e" } };
  check("a helmet adds pixels", avatarSvg(lid).length > avatarSvg(bare).length, true);

  // The aero helmet brings its own visor, so shades under it must not draw.
  const aeroAndShades: Loadout = {
    ...DEFAULT_LOADOUT,
    head: { item: "head.aero", colour: "#20242b", accent: "#c9a227" },
    eyes: { item: "eyes.shades", colour: "#20242b" },
  };
  const aeroAlone: Loadout = { ...aeroAndShades, eyes: { item: "eyes.none", colour: "#20242b" } };
  check("a visor hides the shades under it", avatarSvg(aeroAndShades) === avatarSvg(aeroAlone), true);

  // And only the aero has a second drawing; everything else mirrors.
  const back = avatarSvg(aeroAlone, { view: "back" });
  check("the back view is its own drawing", back !== avatarSvg(aeroAlone), true);
}

console.log(failures === 0 ? "\nAll avatar tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
