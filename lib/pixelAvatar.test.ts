import {
  AVATAR_ITEMS, AVATAR_ITEM_BY_ID, DEFAULT_LOADOUT, STARTER_ITEMS,
  avatarSvg, itemImage, itemSvg, rackFor, type Loadout,
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

const data = sprites as unknown as {
  g: Record<string, unknown>;
  flags: Record<string, { label: string; pal: string[]; sheet: { rows: string[] } }>;
};

/** Where the generator put a sheet — wardrobe in `g`, flags under `flags`. */
const sheetExists = (name: string) =>
  name.startsWith("flag.") ? !!data.flags[name.slice(5)] : !!data.g[name];

console.log("\nevery item the shop sells can be drawn");
{
  const missing = AVATAR_ITEMS.filter((i) => i.sprite && !sheetExists(i.sprite)).map((i) => i.id);
  check("no item points at a sprite that isn't there", missing, []);
  const missingBack = AVATAR_ITEMS.filter((i) => i.spriteBack && !sheetExists(i.spriteBack)).map((i) => i.id);
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
  // The bust is a WINDOW onto the same drawing, not a second sprite that can
  // drift from it. It may leave out layers the window can't show (his shoes
  // aren't in a head-and-shoulders crop), so the check is that every rectangle
  // it draws is one the full figure draws too — and that it drew something.
  const rects = (out: string) => new Set(out.match(/<rect[^/]*\/>/g) ?? []);
  const full = rects(svg);
  const cropped = [...rects(bust)];
  check("the bust draws something", cropped.length > 20, true);
  check("and every mark in it comes from the same drawing",
    cropped.filter((r) => !full.has(r)), []);
  check("a different window, not a different picture",
    bust.match(/viewBox="([^"]+)"/)![1] !== svg.match(/viewBox="([^"]+)"/)![1], true);
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

console.log("\nthe shop has a photo of everything it sells");
{
  // A box with no picture is a box nobody buys.
  const wearable = AVATAR_ITEMS.filter((i) => i.sprite);
  const blank = wearable.filter((i) => itemSvg(i.id) === "").map((i) => i.id);
  check("every item that draws has a product shot", blank, []);
  check("and the empty slots have none", itemSvg("head.none"), "");

  // The shot is the item's own colours, so two colours of one garment are two
  // different photos on the shelf.
  const shots = new Set(AVATAR_ITEMS.filter((i) => i.id.startsWith("torso.jersey.")).map((i) => itemSvg(i.id)));
  check("each colour photographs differently", shots.size, 3);

  // Cropped to what it fills: a watch shouldn't arrive as a mostly-empty box.
  const watch = itemSvg("watch.on.black").match(/viewBox="([^"]+)"/)![1].split(" ").map(Number);
  check("the shot is cropped to the item", watch[2] < 30 && watch[3] < 30, true);

  // And it must be servable as an image, since that is how a shelf of forty
  // boxes stays one node each.
  check("it comes as an image source", itemImage("watch.on.black").startsWith("data:image/svg+xml"), true);
  check("nothing has no image", itemImage("head.none"), "");
}

console.log("\nmerging rectangles mustn't change which pixels are covered");
{
  // Runs merge across AND down, and either direction can silently eat a row or
  // cover one twice. Area alone is too blunt to catch it — the top row of a
  // sheet may hold two pixels — so rebuild the covered CELLS from the rects and
  // compare them with the sprite sheet itself, which the renderer never sees.
  const RIM = "#4a5f7a"; // the cool edge sits on EMPTY cells, so it isn't sprite area
  const sheets = (sprites as unknown as { g: Record<string, { res: number; x0: number; y0: number; rows: string[] }> }).g;

  for (const id of ["torso.jersey.magenta", "watch.on.black", "feet.carbon.gold", "head.aero.gold"]) {
    const item = AVATAR_ITEM_BY_ID.get(id)!;
    const sheet = sheets[item.sprite!];
    const res = sheet.res, ox = sheet.x0 / res, oy = sheet.y0 / res;

    const want = new Set<string>();
    sheet.rows.forEach((row, y) => {
      [...row].forEach((c, x) => { if (c !== ".") want.add(`${x},${y}`); });
    });

    const got = new Set<string>();
    for (const m of itemSvg(id).matchAll(
      /<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"(?: fill="([^"]+)")?\/>/g,
    )) {
      const [, X, Y, W, H, fill] = m;
      if (!fill || fill === RIM) continue; // outline and rim sit outside the sprite
      const cx = Math.round((+X - ox) * res), cy = Math.round((+Y - oy) * res);
      // The rects overlap by 2% so no seam shows; that fudge isn't a cell.
      const cw = Math.round(+W * res - 0.02), ch = Math.round(+H * res - 0.02);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) got.add(`${cx + x},${cy + y}`);
    }

    const missing = [...want].filter((k) => !got.has(k));
    const extra = [...got].filter((k) => !want.has(k));
    check(`${item.label}: every sprite pixel is drawn`, missing.length, 0);
    check(`${item.label}: and nothing is drawn that isn't there`, extra.length, 0);
  }

  // And the merge has to be doing its job, or the phone chokes on forty boxes.
  const rects = (itemSvg("torso.jersey.magenta").match(/<rect /g) ?? []).length;
  check("a jersey is a few hundred rects, not thousands", rects > 20 && rects < 700, true);
}

console.log("\na flag is not the wearer's to recolour");
{
  const banners = AVATAR_ITEMS.filter((i) => i.slot === "banner" && i.sprite);
  check("every country made it into the shop", banners.length, Object.keys(data.flags).length);
  check("each one carries its own palette", banners.every((b) => (b.palette?.length ?? 0) >= 2), true);

  // The palette is the point: Canada drawn in the default colour would be a
  // pink rectangle. Every colour the flag declares must appear in its drawing.
  const canada = AVATAR_ITEM_BY_ID.get("banner.ca")!;
  const svg = itemSvg("banner.ca");
  for (const colour of canada.palette!) {
    check(`Canada is drawn in ${colour}`, svg.includes(colour), true);
  }
  check("and not in the wearer's default", svg.includes("#d4147e"), false);

  // Two countries must not come out as the same picture.
  const drawn = new Set(banners.map((b) => itemSvg(b.id)));
  check("no two flags are the same drawing", drawn.size, banners.length);
}

console.log("\na figure wearing one of everything");
{
  // The crash this caught: nothing here ever rendered a figure WITH a banner,
  // so a banner painted before the skin tone existed blew up only in the app.
  const dressed: Loadout = {
    skin: { item: "skin.deep" }, hair: { item: "hair.curly.black" }, face: { item: "face.beard" },
    head: { item: "head.helmet.magenta" }, eyes: { item: "eyes.shades.black" },
    torso: { item: "torso.jersey.gold" }, hands: { item: "hands.gloves.black" },
    legs: { item: "legs.bibs.black" }, feet: { item: "feet.carbon.gold" },
    socks: { item: "socks.tall.white" }, watch: { item: "watch.on.gold" },
    banner: { item: "banner.ca" },
  };
  const svg = avatarSvg(dressed);
  check("every slot at once still draws", svg.startsWith("<svg") && svg.length > 5000, true);
  check("and from behind", avatarSvg(dressed, { view: "back" }).length > 5000, true);
  check("and as a bust", avatarSvg(dressed, { crop: "bust" }).length > 2000, true);

  // Skin is a choice, and it has to reach the body AND the skin inside an item
  // (the foot in a sandal), not just one of them.
  const pale = avatarSvg({ ...dressed, skin: { item: "skin.light" }, feet: { item: "feet.slides.cyan" } });
  const dark = avatarSvg({ ...dressed, skin: { item: "skin.deep" }, feet: { item: "feet.slides.cyan" } });
  check("changing skin changes the figure", pale !== dark, true);
  check("the light tone is drawn", pale.includes("#f0c9a6"), true);
  check("and the deep one isn't in it", pale.includes("#54301b"), false);

  // A shaved head has nothing to draw from behind — it must not put the
  // eyebrows on the back of his skull.
  const baldBack = avatarSvg({ ...dressed, hair: { item: "hair.bald" }, head: { item: "head.none" } }, { view: "back" });
  const hairBack = avatarSvg({ ...dressed, hair: { item: "hair.curly.black" }, head: { item: "head.none" } }, { view: "back" });
  check("a shaved head is bare from behind", baldBack.length < hairBack.length, true);
}

console.log(failures === 0 ? "\nAll avatar tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
