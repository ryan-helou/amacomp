"use client";

import { useEffect, useState } from "react";
import {
  AVATAR_ITEM_BY_ID,
  DEFAULT_LOADOUT,
  STARTER_ITEMS,
  itemImage,
  rackFor,
  type AvatarItem,
  type Loadout,
  type Slot,
} from "@/lib/pixelAvatar";
import { fmtCoins } from "@/lib/coins";
import { PixelAvatar } from "./PixelAvatar";

const SLOTS: Slot[] = ["head", "eyes", "torso", "legs", "feet", "socks", "watch"];

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

const SHELF: Record<Slot, string> = {
  head: "Headwear",
  eyes: "Eyewear",
  torso: "Tops",
  legs: "Bottoms",
  feet: "Shoes",
  socks: "Socks",
  watch: "Watches",
};

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

      <div className="mt-3 space-y-4">
        {SLOTS.map((slot) => {
          // A visor IS the eyewear, so say so rather than leaving a shelf of
          // boxes that quietly do nothing.
          const hidden =
            slot === "eyes" && AVATAR_ITEM_BY_ID.get(loadout.head?.item ?? "")?.coversEyes;
          return (
            <section key={slot} className={hidden ? "opacity-40" : ""}>
              <h4 className="eyebrow flex items-baseline gap-2 px-1 text-ink-3">
                {SHELF[slot]}
                {hidden && <span className="normal-case text-ink-3">under the visor</span>}
              </h4>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {rackFor(slot).map((item) => (
                  <ShopBox
                    key={item.id}
                    item={item}
                    worn={loadout[slot]?.item === item.id}
                    onPick={() => wear({ ...loadout, [slot]: { item: item.id } })}
                  />
                ))}
              </div>
            </section>
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

/**
 * One box on the shelf: the thing itself, its name, its price.
 *
 * The art is an <img> of a generated SVG rather than an inline drawing. Forty
 * inline figures is megabytes of markup and a phone that stutters; forty images
 * is forty nodes, and the browser caches each one by its source.
 */
function ShopBox({
  item,
  worn,
  onPick,
}: {
  item: AvatarItem;
  worn: boolean;
  onPick: () => void;
}) {
  const src = itemImage(item.id);
  const free = STARTER_ITEMS.has(item.id) || item.price === 0;
  return (
    <button
      onClick={onPick}
      aria-pressed={worn}
      className={`flex flex-col items-stretch overflow-hidden rounded-xl border text-left ${
        worn ? "border-gold bg-gold/10" : "border-line bg-deck-2/40"
      }`}
    >
      <span className="relative flex h-16 items-center justify-center bg-deck-2/60 p-1.5">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- a generated data: URI, not a file
          <img src={src} alt="" className="pixel-avatar h-full w-full object-contain" />
        ) : (
          <span className="eyebrow text-ink-3">nothing</span>
        )}
        {worn && (
          <span className="eyebrow absolute right-1 top-1 rounded bg-gold px-1 py-0.5 text-[0.5rem] text-on-gold">
            worn
          </span>
        )}
      </span>
      <span className="flex min-h-[2.75rem] flex-col justify-between gap-0.5 px-2 py-1.5">
        <span className="text-[0.6875rem] leading-tight text-ink">{item.label}</span>
        <span className="flex items-center gap-1 font-mono text-[0.625rem]">
          {free ? (
            <span className="text-ink-3">yours</span>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- one cached file, forty boxes */}
              <img src="/tri-coin.png" alt="" aria-hidden className="h-3 w-3 object-contain" />
              <span className="text-gold">{fmtCoins(item.price)}</span>
            </>
          )}
        </span>
      </span>
    </button>
  );
}
