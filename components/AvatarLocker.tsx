"use client";

import { useEffect, useState } from "react";
import {
  AVATAR_ITEM_BY_ID,
  DEFAULT_LOADOUT,
  STARTER_ITEMS,
  rackFor,
  type Loadout,
  type Slot,
} from "@/lib/pixelAvatar";
import { fmtCoins } from "@/lib/coins";
import { PixelAvatar } from "./PixelAvatar";

const SLOTS: Slot[] = ["head", "eyes", "torso", "legs", "feet", "socks", "watch"];

/**
 * Chip labels. The garment is obvious from the row and the caption below it, so
 * a chip only has to say which one of them this is — which, now that colours are
 * separate items, is mostly the colour.
 */
const SHORT: Record<string, string> = {
  "head.none": "None", "head.helmet.magenta": "Helmet", "head.helmet.black": "Helmet",
  "head.swimcap.cyan": "Swim", "head.swimcap.magenta": "Swim",
  "head.runcap.mint": "Cap", "head.runcap.white": "Cap",
  "head.aero.black": "Aero", "head.aero.gold": "Aero",
  "eyes.none": "None", "eyes.shades.black": "Shades", "eyes.shades.gold": "Shades",
  "eyes.goggles.cyan": "Goggles", "eyes.goggles.black": "Goggles",
  "torso.bare": "Bare", "torso.tee.magenta": "Shirt", "torso.tee.mint": "Shirt",
  "torso.tee.white": "Shirt", "torso.jersey.magenta": "Jersey",
  "torso.jersey.black": "Jersey", "torso.jersey.gold": "Jersey",
  "torso.trisuit.black": "Tri suit", "torso.trisuit.cyan": "Tri suit",
  "legs.runshorts.black": "Shorts", "legs.runshorts.lime": "Shorts",
  "legs.bibs.black": "Bibs", "legs.bibs.magenta": "Bibs",
  "legs.jammers.black": "Jammers", "legs.jammers.cyan": "Jammers",
  "feet.barefoot": "Bare", "feet.runshoes.white": "Run", "feet.runshoes.orange": "Run",
  "feet.bikeshoes.white": "Bike", "feet.bikeshoes.black": "Bike",
  "feet.carbon.gold": "Carbon", "feet.carbon.mint": "Carbon",
  "socks.none": "None", "socks.short.white": "Short", "socks.short.black": "Short",
  "socks.tall.white": "Tall", "socks.tall.magenta": "Tall",
  "watch.none": "Off", "watch.on.black": "Watch", "watch.on.gold": "Watch",
};

/**
 * The colour a chip is, from the item's own id — the catalogue names coloured
 * items `<slot>.<garment>.<colour>`, so there's nothing to keep in sync.
 */
function toneOf(itemId: string): string | null {
  const tone = itemId.split(".")[2];
  return tone ? tone[0].toUpperCase() + tone.slice(1) : null;
}

const KITS: { name: string; loadout: Loadout }[] = [
  {
    name: "Bike",
    loadout: {
      head: { item: "head.helmet.magenta" }, eyes: { item: "eyes.shades.black" },
      torso: { item: "torso.jersey.magenta" }, legs: { item: "legs.bibs.black" },
      feet: { item: "feet.bikeshoes.white" }, socks: { item: "socks.tall.white" },
      watch: { item: "watch.on.black" },
    },
  },
  {
    name: "Run",
    loadout: {
      head: { item: "head.runcap.mint" }, eyes: { item: "eyes.shades.black" },
      torso: { item: "torso.tee.mint" }, legs: { item: "legs.runshorts.black" },
      feet: { item: "feet.runshoes.white" }, socks: { item: "socks.short.white" },
      watch: { item: "watch.on.black" },
    },
  },
  {
    name: "Swim",
    loadout: {
      head: { item: "head.swimcap.cyan" }, eyes: { item: "eyes.goggles.black" },
      torso: { item: "torso.bare" }, legs: { item: "legs.jammers.black" },
      feet: { item: "feet.barefoot" }, socks: { item: "socks.none" },
      watch: { item: "watch.on.black" },
    },
  },
  {
    name: "Race",
    loadout: {
      head: { item: "head.aero.black" }, eyes: { item: "eyes.none" },
      torso: { item: "torso.trisuit.black" }, legs: { item: "legs.bibs.black" },
      feet: { item: "feet.carbon.gold" }, socks: { item: "socks.short.black" },
      watch: { item: "watch.on.gold" },
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

  function surprise() {
    const next: Loadout = {};
    for (const slot of SLOTS) {
      const rack = rackFor(slot);
      next[slot] = { item: rack[Math.floor(Math.random() * rack.length)].id };
    }
    wear(next);
  }

  // What this outfit would cost someone who only has the starter kit.
  const bill = SLOTS.reduce((sum, slot) => {
    const worn = loadout[slot];
    if (!worn || STARTER_ITEMS.has(worn.item)) return sum;
    return sum + (AVATAR_ITEM_BY_ID.get(worn.item)?.price ?? 0);
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
          const rack = rackFor(slot);
          const item = AVATAR_ITEM_BY_ID.get(worn?.item ?? "");
          const owned = item ? STARTER_ITEMS.has(item.id) || item.price === 0 : false;
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
                {/* One rack, one tap. The dot is the item's own colour, because a
                    colour isn't something you apply to a garment here — the
                    magenta jersey and the black one are two things to buy. */}
                <div className="flex flex-wrap gap-1">
                  {rack.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => wear({ ...loadout, [slot]: { item: o.id } })}
                      aria-pressed={worn?.item === o.id}
                      aria-label={`${o.label}, ${
                        STARTER_ITEMS.has(o.id) || o.price === 0 ? "yours" : `${o.price} coins`
                      }`}
                      className={`flex items-center gap-1.5 rounded-lg border py-1.5 pl-1.5 pr-2 text-[0.6875rem] ${
                        worn?.item === o.id
                          ? "border-gold bg-gold/10 text-ink"
                          : "border-line text-ink-2"
                      }`}
                    >
                      {o.sprite && (
                        <span
                          aria-hidden
                          className="h-3 w-3 shrink-0 rounded-sm border border-line"
                          style={{ background: o.colour }}
                        />
                      )}
                      <span className="text-left leading-tight">
                        {SHORT[o.id] ?? o.label}
                        {/* Two helmets in a row need to say which is which, and a
                            black dot on a dark tile says nothing. */}
                        {toneOf(o.id) && (
                          <span className="block text-[0.5625rem] text-ink-3">{toneOf(o.id)}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>

                {item && (
                  <p className="mt-1 font-mono text-[0.625rem] text-ink-3">
                    {item.label}
                    {" · "}
                    {owned ? (
                      <span className="text-ink-2">yours</span>
                    ) : (
                      <span className="text-gold">{fmtCoins(item.price)} coins</span>
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
