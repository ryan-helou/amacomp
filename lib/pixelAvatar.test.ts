import {
  AVATAR_ITEMS, AVATAR_ITEM_BY_ID, DEFAULT_LOADOUT, STARTER_ITEMS,
  avatarSvg, itemImage, itemSvg, loadoutFor, lookFor, rackFor, type Loadout,
} from "./pixelAvatar";
import { COUNTRY_FLAGS, FLAG_BY_ID, flagLane, flagSvg } from "./flags";
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
const sheetExists = (name: string) => !!data.g[name];

console.log("\nevery item the shop sells can be drawn");
{
  const missing = AVATAR_ITEMS.filter((i) => i.sprite && !sheetExists(i.sprite)).map((i) => i.id);
  check("no item points at a sprite that isn't there", missing, []);
  const missingBack = AVATAR_ITEMS.filter((i) => i.spriteBack && !sheetExists(i.spriteBack)).map((i) => i.id);
  check("and the same for the back views", missingBack, []);
  check("ids are unique", AVATAR_ITEM_BY_ID.size, AVATAR_ITEMS.length);
  // A priced item that nobody can see is a bug in the catalogue. Art is a
  // sprite for anything worn, or a flag for anything flown.
  const paidWithoutArt = AVATAR_ITEMS.filter((i) => i.price > 0 && !i.sprite && !i.flag).map((i) => i.id);
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
  check("the same shirt in white is not", STARTER_ITEMS.has("torso.tee.white"), false);
  check("and it has a price", AVATAR_ITEM_BY_ID.get("torso.tee.white")!.price > 0, true);
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

  // Cropped to what it fills: a pair of slides shouldn't arrive as a
  // mostly-empty box the height of a whole figure.
  const small = itemSvg("feet.slides.cyan").match(/viewBox="([^"]+)"/)![1].split(" ").map(Number);
  check("the shot is cropped to the item", small[2] < 40 && small[3] < 40, true);

  // And it must be servable as an image, since that is how a shelf of forty
  // boxes stays one node each.
  check("it comes as an image source", itemImage("feet.slides.cyan").startsWith("data:image/svg+xml"), true);
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

  for (const id of ["torso.jersey.magenta", "legs.shorts.lime", "feet.carbon.gold", "head.aero.gold"]) {
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

console.log("\nflags are tags, not cloth hung behind him");
{
  // Ryan's call: the hanging banners are gone, and a flag is the small tag the
  // Board already flies for an away week. So a flag item names a country and
  // carries NO sprite — if one ever grew art again, it would be drawn on the
  // figure and we'd be back where we started.
  const flags = AVATAR_ITEMS.filter((i) => i.slot === "flag" && i.id !== "flag.none");
  check("every country made it onto the shelf", flags.length, COUNTRY_FLAGS.length);
  check("none of them has a sprite", flags.filter((f) => f.sprite).length, 0);
  check("each names a flag that exists", flags.every((f) => FLAG_BY_ID.has(f.flag ?? "")), true);

  // The ones Ryan asked for by name.
  for (const id of ["it", "lb", "ca", "qc", "jp", "jo"]) {
    check(`${id} is in the catalogue`, FLAG_BY_ID.has(id), true);
  }

  // A flag is not drawn on the body — wearing one must not change the figure.
  const bare = avatarSvg({ ...DEFAULT_LOADOUT, flag: { item: "flag.none" } });
  const flown = avatarSvg({ ...DEFAULT_LOADOUT, flag: { item: "flag.ca" } });
  check("flying one leaves the figure alone", bare, flown);

  // Two countries must not be the same tag. Compare the DRAWING, not the
  // fields it is built from: the art is now copied wholesale from the official
  // files, so a duplicated copy-paste is the failure this has to catch.
  const drawn = new Set(COUNTRY_FLAGS.map((f) => flagSvg(f.id)));
  check("no two flags are drawn the same", drawn.size, COUNTRY_FLAGS.length);
  check("every flag has a drawing", COUNTRY_FLAGS.every((f) => f.art.length > 60), true);

  // The bug this catches: Quebec, Brazil and Kenya use `xlink:href`, and the
  // lane embeds the same markup in a data: URI, which is parsed as strict XML.
  // An undeclared prefix throws out the WHOLE image, so all three flags
  // silently disappeared from every lane while still drawing fine inline —
  // HTML parsing is lenient and had been covering for it.
  const needXlink = COUNTRY_FLAGS.filter((f) => f.art.includes("xlink:"));
  check("some flags use xlink", needXlink.length > 0, true);
  const undeclared = needXlink.filter((f) => !flagSvg(f.id).includes("xmlns:xlink"));
  check("every flag that uses xlink declares it", undeclared.map((f) => f.id), []);
  const laneMissing = COUNTRY_FLAGS.filter((f) => {
    const bg = flagLane(f.id)?.backgroundImage ?? "";
    return f.art.includes("xlink:") && !bg.includes("xmlns%3Axlink");
  });
  check("and declares it in the lane too", laneMissing.map((f) => f.id), []);
  check("every band is a colour", COUNTRY_FLAGS.every((f) => f.bands.every((b) => /^#[0-9A-Fa-f]{6}$/.test(b))), true);
}

console.log("\na figure wearing one of everything");
{
  // The crash this caught: nothing here ever rendered a figure WITH a banner,
  // so a banner painted before the skin tone existed blew up only in the app.
  const dressed: Loadout = {
    skin: { item: "skin.deep" }, hair: { item: "hair.curly.black" }, face: { item: "face.beard" },
    head: { item: "head.helmet.magenta" }, eyes: { item: "eyes.shades.black" },
    torso: { item: "torso.jersey.gold" }, hands: { item: "hands.gloves.black" },
    legs: { item: "legs.shorts.magenta" }, feet: { item: "feet.carbon.gold" },
    banner: { item: "banner.ca" },
  };
  const svg = avatarSvg(dressed);
  check("every slot at once still draws", svg.startsWith("<svg") && svg.length > 5000, true);
  check("and from behind", avatarSvg(dressed, { view: "back" }).length > 5000, true);
  check("and as a bust", avatarSvg(dressed, { crop: "bust" }).length > 2000, true);

  // Skin has to reach the BODY, not just the bare-skin pixels inside an item.
  // The old check asked whether the chosen colour appeared anywhere, and passed
  // while the body was still drawn in the default tone — the colour it found
  // was a sandal's foot. So: pick a tone, and the default must be GONE.
  const FAIR = "#dda077";
  for (const [tone, hex] of [["skin.light", "#f0c9a6"], ["skin.deep", "#54301b"], ["skin.brown", "#7c4a2a"]] as const) {
    const svg = avatarSvg({ ...dressed, skin: { item: tone }, feet: { item: "feet.slides.cyan" } });
    check(`${tone} is drawn`, svg.includes(hex), true);
    check(`${tone} leaves no default skin behind`, svg.includes(FAIR), false);
  }
  check("and the bust follows the same tone",
    avatarSvg({ ...dressed, skin: { item: "skin.deep" } }, { crop: "bust" }).includes(FAIR), false);

  // A shaved head has nothing to draw from behind — it must not put the
  // eyebrows on the back of his skull.
  const baldBack = avatarSvg({ ...dressed, hair: { item: "hair.bald" }, head: { item: "head.none" } }, { view: "back" });
  const hairBack = avatarSvg({ ...dressed, hair: { item: "hair.curly.black" }, head: { item: "head.none" } }, { view: "back" });
  check("a shaved head is bare from behind", baldBack.length < hairBack.length, true);
}

console.log("\nnothing on the face may cover the eyes");
{
  /**
   * The beard grew over his eyes and the drawing couldn't tell me — a layer
   * painted on top still emits the rectangles underneath it, so comparing
   * output finds nothing. This works in sprite space instead: the eyes are the
   * "E" cells of the body sheet, and a beard or a hairstyle must not put a
   * filled cell on any of them. (Eyewear is exempt: covering eyes is its job.)
   */
  const sheet = sprites as unknown as {
    base: string[];
    g: Record<string, { res: number; x0: number; y0: number; rows: string[] }>;
  };

  const eyes = new Set<string>();
  sheet.base.forEach((row, y) => {
    [...row].forEach((c, x) => { if (c === "E") eyes.add(`${x},${y}`); });
  });
  check("the body has eyes to protect", eyes.size > 10, true);

  for (const item of AVATAR_ITEMS) {
    // The crown is worn on the skull like hair, so it is held to the same
    // rule — a band that slips down over the eyes is the beard bug again.
    if (item.slot !== "face" && item.slot !== "hair" && item.slot !== "prize") continue;
    if (!item.sprite) continue;
    const sh = sheet.g[item.sprite];
    let hits = 0;
    sh.rows.forEach((row, ry) => {
      [...row].forEach((c, rx) => {
        if (c === "." || c === "M") return; // "M" is the mouth showing through
        const ux = Math.floor((sh.x0 + rx) / sh.res);
        const uy = Math.floor((sh.y0 + ry) / sh.res);
        if (eyes.has(`${ux},${uy}`)) hits++;
      });
    });
    check(`${item.label} leaves the eyes alone`, hits, 0);
  }
}

console.log("\none country, one purchase, one drawing");
{
  // Ryan's call: flags and lanes were two things to buy for one country, and
  // the lane was an impression of the flag rather than the flag. Now buying a
  // country gives you the tag beside your name AND the lane behind your row,
  // both painted from the same SVG.
  const flags = AVATAR_ITEMS.filter((i) => i.slot === "flag" && i.id !== "flag.none");
  check("one item per country", flags.length, COUNTRY_FLAGS.length);
  check("and no separate lane to buy", AVATAR_ITEMS.some((i) => i.slot === ("lane" as string)), false);

  for (const f of COUNTRY_FLAGS) {
    const svg = flagSvg(f.id);
    // The drawing has to contain the country's own colours, or it's some
    // other country.
    // The official files write colours however they like — `#f00`, `#060`,
    // lowercase — so both sides are normalised before they are compared.
    const wide = (c: string) =>
      (c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c).toLowerCase();
    const inArt = new Set((svg.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).map(wide));
    // Black is the default fill, so a flag may use it without naming it.
    const missing = f.bands.filter((b) => wide(b) !== "#000000" && !inArt.has(wide(b)));
    check(`${f.label} is drawn in its own colours`, missing, []);
    check(`${f.label} makes a lane`, !!flagLane(f.id)?.backgroundImage, true);
  }

  // The lane is the flag at FULL STRENGTH, in two layers and no wash: the
  // bands stretched the whole row, and the emblem on top at its own
  // proportions, centred. Every part of that has been got wrong once.
  const lane = flagLane("ca")!;
  const size = lane.backgroundSize.split(", ");
  // The fade lives INSIDE the field SVG, as a mask, not as a CSS gradient
  // layer stacked on top — so the flag thins where the name runs instead of
  // having something grey laid over it.
  check("no gradient layer over the flag", lane.backgroundImage.includes("linear-gradient("), false);
  check("the field fades with a mask", decodeURIComponent(lane.backgroundImage.split('url("')[2]).includes("<mask"), true);
  check("two layers: emblem, field", size.length, 2);
  check("the field runs the whole row", size[1], "100% 100%");
  // The emblem is `auto`, never a percentage. A percentage is a stretch.
  // `auto`, never a percentage: a percentage is a stretch. Fitted to 76% of
  // the row, the way lib/away.ts has always sized its leaf, so the emblem
  // sits IN the row rather than filling it edge to edge.
  check("the emblem keeps its own shape", size[0], "auto 76%");
  check("and every flag is centred", lane.backgroundPosition.split(", ")[0], "50% center");
  check("Brazil too", flagLane("br")!.backgroundPosition.split(", ")[0], "50% center");
  check("the lane carries Canada's red", lane.backgroundImage.includes("%23FF0000"), true);

  // THE BUG, twice over: `preserveAspectRatio="none"` strips an SVG of its
  // intrinsic ratio, so `background-size: auto` has nothing to reason from
  // and falls back to the full width of the row — which is the very stretch
  // the emblem layer exists to undo. Japan's disc stayed an ellipse through
  // two attempts before this was understood. The FIELD may say none; the
  // emblem may never.
  for (const f of COUNTRY_FLAGS) {
    const parts = flagLane(f.id)!.backgroundImage.split('url("');
    if (parts.length < 3) continue; // Italy is stripes; it has no emblem layer
    const emblem = decodeURIComponent(parts[1]);
    check(`${f.label}'s emblem keeps its ratio`, emblem.includes('preserveAspectRatio="none"'), false);
    // A size on the root is what gives the image its intrinsic ratio. The
    // width varies: Jordan's chevron is widened to reach across the row.
    check(`${f.label}'s emblem declares a size`, /width="[\d.]+" height="20"/.test(emblem), true);
  }
  // Jordan's thirds put the name on the white, the detail line on the green
  // and the bar across the join — the only row where the text crossed two
  // colours. The lane gives the middle band double width, as Lebanon has
  // always had. The TAG keeps the flag's true thirds.
  const jo = FLAG_BY_ID.get("jo")!;
  check("Jordan's flag is still thirds", jo.weights, undefined);
  check("but its lane widens the middle", jo.laneWeights, [1, 2, 1]);
  // The tag is the copied file, untouched: its green band still starts at
  // 3360 of 5040, which is two thirds down.
  check("and the tag is still the real flag", flagSvg("jo").includes("m0 3360h10080v1680H0z"), true);
  // And its chevron is the HOIST: hard against the left edge, full height,
  // not floating in the middle of the row like an emblem.
  const joLane = flagLane("jo")!;
  check("the chevron sits at the hoist", joLane.backgroundPosition.split(", ")[0], "0% center");
  check("and runs the full height", joLane.backgroundSize.split(", ")[0], "auto 100%");

  check("Italy has no emblem layer — it is only stripes",
    flagLane("it")!.backgroundImage.split('url("').length, 2);

  // With nothing softening the flag, the ink is the ONLY thing keeping a row
  // readable, so it matters more than it did, not less. It follows the band
  // under the text: the middle one across, the first one down.
  check("a white flag takes dark ink", !!flagLane("jp")?.["--ink"], true);
  check("a white middle stripe does too", !!flagLane("jo")?.["--ink"], true);
  check("and Lebanon's", !!flagLane("lb")?.["--ink"], true);
  // The one the flat wash broke: Canada's name sits on the WHITE band, so it
  // needs dark ink even though the flag's first band is red.
  check("and Canada's white centre", !!flagLane("ca")?.["--ink"], true);
  check("Italy's too", !!flagLane("it")?.["--ink"], true);
  check("a dark flag keeps the light ink", flagLane("br")?.["--ink"], undefined);
  check("and Quebec's blue", flagLane("qc")?.["--ink"], undefined);
  check("a red field leaves it alone", flagLane("vn")?.["--ink"], undefined);
  check("and so does a dark middle stripe", flagLane("de")?.["--ink"], undefined);

  // No two countries may draw the same.
  const drawn = new Set(COUNTRY_FLAGS.map((f) => flagSvg(f.id)));
  check("every flag is its own picture", drawn.size, COUNTRY_FLAGS.length);
}

console.log("\na saved look is topped up, never left bare");
{
  const me = { id: "a1", name: "Ryan" };
  // What the till actually stores: only the slots he owns or that are free.
  const partial = { a1: { hair: { item: "hair.bald" }, skin: { item: "skin.light" } } };
  const look = lookFor(me, partial);
  check("his own choices win", [look.hair.item, look.skin.item], ["hair.bald", "skin.light"]);
  // The bug: these came back undefined and the figure drew with no clothes.
  for (const slot of ["torso", "legs", "feet", "face"]) {
    check(`${slot} is filled in, not left empty`, !!look[slot]?.item, true);
  }
  check("and it is still his own generated look", look.torso.item, loadoutFor("Ryan").torso.item);
  check("no saved look at all is the generated one", lookFor(me, {}).torso.item, loadoutFor("Ryan").torso.item);
}

console.log("\na prize is not for sale");
{
  const prizes = AVATAR_ITEMS.filter((i) => i.slot === "prize" && i.sprite);
  check("there are prizes on the shelf", prizes.length, 5);
  // Free AND earned, both: free alone would let the till hand one out, and
  // the shop would print "0 coins" where it should print what wins it.
  for (const p of prizes) {
    check(`${p.label} costs no coins`, p.price, 0);
    check(`${p.label} says what wins it`, !!p.earned && p.earned.length > 0, true);
  }
  // And nothing you can pay for may claim to be won.
  const confused = AVATAR_ITEMS.filter((i) => i.earned && i.price > 0);
  check("nothing is both won and sold", confused.length, 0);
}

console.log(failures === 0 ? "\nAll avatar tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
