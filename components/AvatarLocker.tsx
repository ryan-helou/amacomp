"use client";

import { useEffect, useState } from "react";
import {
  AVATAR_ITEMS,
  AVATAR_ITEM_BY_ID,
  DEFAULT_LOADOUT,
  STARTER_SKUS,
  skuPrice,
  waysFor,
  type Loadout,
  type Slot,
} from "@/lib/pixelAvatar";
import { fmtCoins } from "@/lib/coins";
import { PixelAvatar } from "./PixelAvatar";

const SLOTS: Slot[] = ["head", "eyes", "torso", "legs", "feet", "socks", "watch"];

/**
 * Chip labels, short enough that a slot's whole rack fits one line on a phone.
 * The catalogue keeps the real names — those are what the shop will sell.
 */
const SHORT: Record<string, string> = {
  "head.none": "None", "head.helmet": "Helmet", "head.swimcap": "Swim", "head.runcap": "Cap",
  "head.aero": "Aero", "eyes.none": "None", "eyes.shades": "Shades", "eyes.goggles": "Goggles",
  "torso.bare": "Bare", "torso.jersey": "Jersey", "torso.tee": "Shirt", "torso.trisuit": "Tri suit",
  "legs.bibs": "Bibs", "legs.runshorts": "Shorts", "legs.jammers": "Jammers",
  "feet.barefoot": "Bare", "feet.bikeshoes": "Bike", "feet.runshoes": "Run", "feet.carbon": "Carbon",
  "socks.none": "None", "socks.short": "Short", "socks.tall": "Tall",
  "watch.none": "Off", "watch.on": "Watch",
};

const KITS: { name: string; loadout: Loadout }[] = [
  {
    name: "Bike",
    loadout: {
      head: { item: "head.helmet", way: "magenta" },
      eyes: { item: "eyes.shades", way: "black" },
      torso: { item: "torso.jersey", way: "magenta" },
      legs: { item: "legs.bibs", way: "black" },
      feet: { item: "feet.bikeshoes", way: "white" },
      socks: { item: "socks.tall", way: "white" },
      watch: { item: "watch.on", way: "black" },
    },
  },
  {
    name: "Run",
    loadout: {
      head: { item: "head.runcap", way: "mint" },
      eyes: { item: "eyes.shades", way: "black" },
      torso: { item: "torso.tee", way: "mint" },
      legs: { item: "legs.runshorts", way: "black" },
      feet: { item: "feet.runshoes", way: "white" },
      socks: { item: "socks.short", way: "white" },
      watch: { item: "watch.on", way: "black" },
    },
  },
  {
    name: "Swim",
    loadout: {
      head: { item: "head.swimcap", way: "cyan" },
      eyes: { item: "eyes.goggles", way: "black" },
      torso: { item: "torso.bare", way: "stock" },
      legs: { item: "legs.jammers", way: "black" },
      feet: { item: "feet.barefoot", way: "stock" },
      socks: { item: "socks.none", way: "stock" },
      watch: { item: "watch.on", way: "cyan" },
    },
  },
  {
    name: "Race",
    loadout: {
      head: { item: "head.aero", way: "black" },
      eyes: { item: "eyes.none", way: "stock" },
      torso: { item: "torso.trisuit", way: "black" },
      legs: { item: "legs.bibs", way: "black" },
      feet: { item: "feet.carbon", way: "gold" },
      socks: { item: "socks.short", way: "black" },
      watch: { item: "watch.on", way: "gold" },
    },
  },
];

const STORE_KEY = "amacomp.locker";

/**
 * The locker, Ryan's preview only (see `canPreviewAvatar`).
 *
 * Nothing here is saved to the league yet: it exists so the figure can be judged
 * at real size, on a real phone, against the app's own background.
 *
 * It is deliberately FLAT. An earlier version made you pick a slot, then an item,
 * then a colour — three taps to see one change, and only one slot's state visible
 * at a time, which is useless when the job is comparing gear. Here every slot's
 * rack is on screen at once, so any change is one tap, and front and back are both
 * drawn so nothing has to be toggled to be checked.
 *
 * The swatches are NOT a palette. Each one is its own thing to buy: the magenta
 * jersey and the black jersey are two purchases, and owning one doesn't give you
 * the other. That's why a swatch carries a price rather than recolouring what you
 * already have.
 */
export function AvatarLocker() {
  const [loadout, setLoadout] = useState<Loadout>(KITS[0].loadout);

  // The last outfit comes back on reload — this thing gets opened a hundred times
  // in a row while the art is being judged. Per-browser only, and never required.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, restoring the last outfit
      if (raw) setLoadout(JSON.parse(raw) as Loadout);
    } catch {
      /* private window, blocked storage: the default kit is fine */
    }
  }, []);

  function wear(next: Loadout) {
    setLoadout(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* nothing to do: the figure still changes */
    }
  }

  /** Switching item keeps the colourway when that item is sold in it. */
  function pickItem(slot: Slot, itemId: string) {
    const rack = waysFor(itemId);
    const keep = rack.find((w) => w.id === loadout[slot]?.way) ?? rack[0];
    wear({ ...loadout, [slot]: { item: itemId, way: keep.id } });
  }

  function surprise() {
    const next: Loadout = {};
    for (const slot of SLOTS) {
      const rack = AVATAR_ITEMS.filter((i) => i.slot === slot);
      const pick = rack[Math.floor(Math.random() * rack.length)];
      const ways = waysFor(pick.id);
      next[slot] = { item: pick.id, way: ways[Math.floor(Math.random() * ways.length)].id };
    }
    wear(next);
  }

  // What this outfit would cost someone who only has the starter kit.
  const bill = SLOTS.reduce((sum, slot) => {
    const worn = loadout[slot];
    if (!worn || STARTER_SKUS.has(`${worn.item}/${worn.way}`)) return sum;
    return sum + skuPrice(worn.item, worn.way);
  }, 0);

  return (
    <section className="rounded-2xl pane border border-gold/40 bg-tile px-3 py-4">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h3 className="stamp text-lg text-gold">LOCKER</h3>
        <span className="eyebrow text-ink-3">Yours only · not saved yet</span>
      </div>

      {/* Front and back together: turning him around shouldn't cost a tap. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["front", "back"] as const).map((view) => (
          <div key={view} className="rounded-xl border border-line bg-deck-2/40 px-2 pb-1 pt-2">
            <PixelAvatar loadout={loadout} view={view} className="mx-auto w-full max-w-[9rem]" />
            <span className="eyebrow mt-1 block text-center text-ink-3">{view}</span>
          </div>
        ))}
      </div>

      <p className="mt-2 px-1 text-center font-mono text-[0.6875rem] text-ink-3">
        this outfit costs <span className="text-gold">{fmtCoins(bill)}</span> beyond the starter kit
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5 px-1">
        {KITS.map((k) => (
          <button
            key={k.name}
            onClick={() => wear(k.loadout)}
            className="eyebrow rounded-full border border-line px-3 py-1.5 text-ink-2"
          >
            {k.name}
          </button>
        ))}
        <button
          onClick={surprise}
          className="eyebrow rounded-full border border-dashed border-line px-3 py-1.5 text-ink-3"
        >
          Random
        </button>
        <button
          onClick={() => wear(DEFAULT_LOADOUT)}
          className="eyebrow rounded-full border border-dashed border-line px-3 py-1.5 text-ink-3"
        >
          Reset
        </button>
      </div>

      <div className="mt-2 divide-y divide-line">
        {SLOTS.map((slot) => {
          // A visor IS the eyewear, so say so rather than leaving a row of
          // buttons that quietly do nothing.
          const hidden =
            slot === "eyes" && AVATAR_ITEM_BY_ID.get(loadout.head?.item ?? "")?.coversEyes;
          const worn = loadout[slot];
          const rack = AVATAR_ITEMS.filter((i) => i.slot === slot);
          const ways = waysFor(worn?.item ?? "");
          const item = AVATAR_ITEM_BY_ID.get(worn?.item ?? "");
          const way = ways.find((w) => w.id === worn?.way) ?? ways[0];
          const price = skuPrice(worn?.item ?? "", worn?.way ?? "");
          const owned = STARTER_SKUS.has(`${worn?.item}/${worn?.way}`) || price === 0;
          return (
            <div
              key={slot}
              className={`grid grid-cols-[3.25rem_1fr] items-start gap-2 py-2 ${
                hidden ? "opacity-40" : ""
              }`}
            >
              <span className="eyebrow pt-1.5 text-ink-3">
                {slot}
                {hidden && <span className="mt-0.5 block normal-case">under the visor</span>}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1">
                  {rack.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => pickItem(slot, o.id)}
                      aria-pressed={worn?.item === o.id}
                      className={`rounded-lg border px-2 py-1.5 text-[0.6875rem] ${
                        worn?.item === o.id
                          ? "border-gold bg-gold/10 text-ink"
                          : "border-line text-ink-2"
                      }`}
                    >
                      {SHORT[o.id] ?? o.label}
                    </button>
                  ))}
                </div>

                {/* Each swatch is a separate purchase, not a recolour. Stock items
                    (bare feet, an empty slot) have nothing to choose between. */}
                {ways.length > 1 && (
                  <div className="mt-1.5 flex items-center gap-1">
                    {ways.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => wear({ ...loadout, [slot]: { item: worn.item, way: w.id } })}
                        aria-pressed={worn?.way === w.id}
                        aria-label={`${w.label} ${item?.label ?? slot}, ${
                          STARTER_SKUS.has(`${worn.item}/${w.id}`)
                            ? "yours"
                            : `${skuPrice(worn.item, w.id)} coins`
                        }`}
                        className={`h-5 w-5 rounded-sm border-2 ${
                          worn?.way === w.id ? "border-ink" : "border-line"
                        }`}
                        style={{ background: w.colour }}
                      />
                    ))}
                  </div>
                )}

                {item && way && (
                  <p className="mt-1 font-mono text-[0.625rem] text-ink-3">
                    {ways.length > 1 ? `${way.label} · ${item.label}` : item.label}
                    {" · "}
                    {owned ? (
                      <span className="text-ink-2">yours</span>
                    ) : (
                      <span className="text-gold">{fmtCoins(price)} coins</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex items-center gap-3 border-t border-line px-1 pt-3">
        <span className="eyebrow text-ink-3">On the board</span>
        <span className="h-9 w-9 overflow-hidden rounded-full border border-line bg-deck-2/40">
          <PixelAvatar loadout={loadout} bust className="h-full w-full" />
        </span>
        <span className="h-9 w-9 overflow-hidden rounded-full border border-line bg-deck-2/40">
          <PixelAvatar loadout={DEFAULT_LOADOUT} bust className="h-full w-full" />
        </span>
        <span className="text-xs text-ink-3">yours · a new athlete&rsquo;s</span>
      </div>
    </section>
  );
}
