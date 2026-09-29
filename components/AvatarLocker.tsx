"use client";

import { memo, useCallback, useEffect, useState } from "react";
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
import { coinAccount, fmtCoins } from "@/lib/coins";
import type { AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import { PixelAvatar } from "./PixelAvatar";

// You first, then what you put on, then what flies behind you.
const SLOTS: Slot[] = [
  "skin", "hair", "face",
  "head", "eyes", "torso", "hands", "legs", "feet", "socks", "watch", "banner",
];

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
      torso: { item: "torso.wetsuit.black" }, legs: { item: "legs.jammers.black" },
      feet: { item: "feet.barefoot" }, socks: { item: "socks.none" },
      watch: { item: "watch.on.black" }, hands: { item: "hands.none" },
    },
  },
  {
    name: "Winter",
    loadout: {
      head: { item: "head.beanie.black" }, eyes: { item: "eyes.none" },
      torso: { item: "torso.jacket.orange" }, legs: { item: "legs.tights.black" },
      feet: { item: "feet.trail.black" }, socks: { item: "socks.tall.white" },
      watch: { item: "watch.on.black" }, hands: { item: "hands.gloves.black" },
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
  skin: "Skin",
  hair: "Hair",
  face: "Face",
  banner: "Banners",
  head: "Headwear",
  eyes: "Eyewear",
  torso: "Tops",
  hands: "Hands",
  legs: "Bottoms",
  feet: "Shoes",
  socks: "Socks",
  watch: "Watches",
};

/**
 * What a tier looks like. Common gear is quiet; the dear stuff earns its ring,
 * which is how a shelf tells you what's worth saving for without a word.
 */
const TIER: Record<AvatarItem["tier"], { ring: string; tag: string | null; glow?: string }> = {
  common: { ring: "border-line", tag: null },
  rare: { ring: "border-[#3d7fd6]/60", tag: "rare", glow: "#3d7fd6" },
  epic: { ring: "border-[#9a5cf0]/60", tag: "epic", glow: "#9a5cf0" },
  legendary: { ring: "border-gold/70", tag: "legendary", glow: "var(--color-gold)" },
};

const STORE_KEY = "amacomp.locker";

/**
 * The locker, on the laptop only (see `SHOW_AVATAR_SHOP` in lib/club.ts).
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
export function AvatarLocker({ state, refDay }: { state: AppState; refDay: DayKey }) {
  /**
   * The outfit and how it got here, in one piece of state.
   *
   * One object rather than two, so the callbacks the boxes get can be created
   * once and never change — 124 boxes re-rendering for a change that touches
   * one of them cost 563ms on a throttled phone.
   */
  const [{ loadout, past }, setFit] = useState<{ loadout: Loadout; past: Loadout[] }>({
    loadout: KITS[0].loadout,
    past: [],
  });
  const [query, setQuery] = useState("");
  const [affordableOnly, setAffordableOnly] = useState(false);

  // The last outfit comes back on reload — this thing gets opened a hundred times
  // in a row while the art is being judged. Per-browser only, and never required.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, restoring the last outfit
      if (raw) setFit({ loadout: JSON.parse(raw) as Loadout, past: [] });
    } catch {
      /* private window, blocked storage: the default kit is fine */
    }
  }, []);

  // Saved after the fact, so the setters above stay pure.
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(loadout));
    } catch {
      /* the figure still changes */
    }
  }, [loadout]);

  const wear = useCallback((next: Loadout) => {
    setFit((f) => ({ loadout: next, past: [f.loadout, ...f.past].slice(0, 20) }));
  }, []);

  const pick = useCallback((slot: Slot, itemId: string) => {
    setFit((f) => ({
      loadout: { ...f.loadout, [slot]: { item: itemId } },
      past: [f.loadout, ...f.past].slice(0, 20),
    }));
  }, []);

  const undo = useCallback(() => {
    setFit((f) => (f.past.length ? { loadout: f.past[0], past: f.past.slice(1) } : f));
  }, []);

  const YOU: Slot[] = ["skin", "hair", "face"];

  function surprise() {
    setFit((f) => {
      const next: Loadout = { ...f.loadout };
      for (const slot of SLOTS) {
        if (YOU.includes(slot)) continue;
        const rack = rackFor(slot);
        next[slot] = { item: rack[Math.floor(Math.random() * rack.length)].id };
      }
      return { loadout: next, past: [f.loadout, ...f.past].slice(0, 20) };
    });
  }

  // What he could actually spend. A shop with a made-up balance is a mock.
  const balance = coinAccount(
    state.me?.id ?? "", state.athletes, state.activities, state.settings, refDay,
  ).balance;

  // What this outfit would cost someone who only has the starter kit.
  const bill = SLOTS.reduce((sum, slot) => {
    const worn = loadout[slot];
    if (!worn || STARTER_ITEMS.has(worn.item)) return sum;
    return sum + (AVATAR_ITEM_BY_ID.get(worn.item)?.price ?? 0);
  }, 0);

  // Worn = anything that isn't the slot's free default, which is what the
  // take-off strip lists.
  const worn = SLOTS.flatMap((slot) => {
    const item = AVATAR_ITEM_BY_ID.get(loadout[slot]?.item ?? "");
    if (!item || item.price === 0) return [];
    return [{ slot, item }];
  });

  const needle = query.trim().toLowerCase();

  /** What a shelf shows after the search box and the "can afford" switch. */
  function shown(slot: Slot): AvatarItem[] {
    return rackFor(slot).filter((item) => {
      if (loadout[slot]?.item === item.id) return true; // never hide what you're wearing
      if (needle && !item.label.toLowerCase().includes(needle)) return false;
      if (affordableOnly && item.price > balance && !STARTER_ITEMS.has(item.id)) return false;
      return true;
    });
  }

  const shelves = SLOTS.map((slot) => ({ slot, items: shown(slot) })).filter((s) => s.items.length > 0);
  const hits = shelves.reduce((n, s) => n + s.items.length, 0);

  /** Jump to a shelf, leaving room for the bar that's pinned over it. */
  function jump(slot: Slot) {
    const el = document.getElementById(`shelf-${slot}`);
    if (!el) return;
    const bar = document.getElementById("locker-bar")?.getBoundingClientRect().height ?? 0;
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - bar - 12, behavior: "smooth" });
  }

  return (
    <section className="overflow-clip rounded-2xl pane border border-gold/40 bg-tile">
      {/* The stage: a lit floor, him on it, and what he'd cost to dress. */}
      <div
        className="relative px-3 pb-3 pt-4"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--color-gold) 14%, transparent) 0%, transparent 65%)",
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="stamp text-lg text-gold">LOCKER</h3>
          <span className="eyebrow text-ink-3">{state.me?.name} · not saved yet</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["front", "back"] as const).map((view) => (
            <div
              key={view}
              className="relative overflow-hidden rounded-xl border border-line/70"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--color-deck-2) 70%, transparent) 0%, var(--color-deck-2) 100%)",
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-4 bottom-2 h-3 rounded-[50%]"
                style={{ background: "radial-gradient(50% 100% at 50% 50%, rgba(0,0,0,0.55), transparent 70%)" }}
              />
              <PixelAvatar
                loadout={loadout}
                view={view}
                className="relative mx-auto w-full max-w-[9.5rem] px-2 pt-2"
              />
              <span className="eyebrow relative block pb-1.5 text-center text-[0.5625rem] text-ink-3">
                {view}
              </span>
            </div>
          ))}
        </div>

        {/* The till: what he has, what the outfit runs to. */}
        <div className="mt-3 flex items-stretch gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-deck-2/50 px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- one cached file */}
            <img src="/tri-coin.png" alt="" aria-hidden className="h-5 w-5 object-contain" />
            <span className="min-w-0">
              <span className="eyebrow block text-[0.5625rem] text-ink-3">balance</span>
              <span className="stamp block text-base leading-none tabular-nums text-gold">
                {fmtCoins(balance)}
              </span>
            </span>
          </div>
          <div
            className={`flex flex-1 flex-col justify-center rounded-xl border px-3 py-2 ${
              bill > balance ? "border-line bg-deck-2/50" : "border-gold/40 bg-gold/10"
            }`}
          >
            <span className="eyebrow text-[0.5625rem] text-ink-3">this outfit</span>
            <span
              className={`stamp text-base leading-none tabular-nums ${
                bill > balance ? "text-ink-2" : "text-gold"
              }`}
            >
              {fmtCoins(bill)}
            </span>
          </div>
        </div>

        {/* What you've actually put on, and one tap to take it off again.
            Without this, removing a hat means scrolling back to Headwear and
            hunting for the word "None". */}
        {worn.length > 0 && (
          <div className="mt-2.5 grid grid-cols-2 gap-1">
            {worn.map(({ slot, item }) => (
              <button
                key={slot}
                onClick={() => {
                  const free = rackFor(slot).find((i) => i.price === 0);
                  if (free) wear({ ...loadout, [slot]: { item: free.id } });
                }}
                aria-label={`Take off ${item.label}`}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-deck-2/40 px-2 py-1 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-[0.625rem] text-ink-2">{item.label}</span>
                <span aria-hidden className="shrink-0 text-[0.75rem] leading-none text-ink-3">×</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {KITS.map((k) => (
            <button
              key={k.name}
              onClick={() => wear({ ...loadout, ...k.loadout })}
              className="eyebrow rounded-full border border-line bg-deck-2/40 px-3 py-1.5 text-ink-2"
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
            onClick={() => wear({ ...DEFAULT_LOADOUT, ...Object.fromEntries(YOU.map((s2) => [s2, loadout[s2]])) })}
            className="eyebrow rounded-full border border-dashed border-line px-3 py-1.5 text-ink-3"
          >
            Reset
          </button>
          <button
            onClick={undo}
            disabled={past.length === 0}
            className="eyebrow rounded-full border border-dashed border-line px-3 py-1.5 text-ink-3 disabled:opacity-30"
          >
            Undo
          </button>
        </div>
      </div>

      {/* Pinned while you browse: what you're wearing, and where to jump to.
          Ninety-odd items is a long scroll, and a shop you have to scroll back
          up in to see what you've done is a shop you stop using. */}
      <div
        id="locker-bar"
        className="sticky z-20 border-y border-line bg-tile/95 px-2 py-2 backdrop-blur"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center gap-2">
          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-gold/50 bg-deck-2">
            <PixelAvatar loadout={loadout} bust flat className="h-full w-full" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the shop"
            aria-label="Search the shop"
            className="min-w-0 flex-1 rounded-lg border border-line bg-deck-2/60 px-2.5 py-1.5 text-[0.8125rem] text-ink placeholder:text-ink-3"
          />
          <button
            onClick={() => setAffordableOnly((v) => !v)}
            aria-pressed={affordableOnly}
            className={`eyebrow shrink-0 rounded-lg border px-2 py-1.5 ${
              affordableOnly ? "border-gold bg-gold/10 text-gold" : "border-line text-ink-3"
            }`}
          >
            can afford
          </button>
        </div>
        <div className="mt-1.5 -mx-2 flex gap-1 overflow-x-auto px-2 pb-0.5">
          {shelves.map(({ slot, items }) => (
            <button
              key={slot}
              onClick={() => jump(slot)}
              className="eyebrow shrink-0 rounded-full border border-line bg-deck-2/40 px-2.5 py-1 text-[0.5625rem] text-ink-2"
            >
              {SHELF[slot]} <span className="text-ink-3">{items.length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5 px-3 py-4">
        {shelves.map(({ slot, items }) => {
          // A visor IS the eyewear, so say so rather than leaving a shelf of
          // boxes that quietly do nothing.
          const hidden =
            slot === "eyes" && AVATAR_ITEM_BY_ID.get(loadout.head?.item ?? "")?.coversEyes;
          return (
            <section
              key={slot}
              id={`shelf-${slot}`}
              className={hidden ? "opacity-40" : ""}
              // Nine shelves of boxes is a lot of layout; skip the ones nobody
              // is looking at. The reserved height keeps the scrollbar honest.
              style={{ contentVisibility: "auto", containIntrinsicSize: "auto 420px" }}
            >
              <h4 className="flex items-center gap-2">
                <span className="eyebrow shrink-0 text-ink-2">{SHELF[slot]}</span>
                <span aria-hidden className="h-px flex-1 bg-line" />
                {hidden && <span className="eyebrow shrink-0 text-ink-3">under the visor</span>}
                <button
                  onClick={() => {
                    const rack = rackFor(slot);
                    wear({ ...loadout, [slot]: { item: rack[Math.floor(Math.random() * rack.length)].id } });
                  }}
                  aria-label={`Random ${SHELF[slot]}`}
                  className="eyebrow shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[0.5rem] text-ink-3"
                >
                  {/* A die character renders as tofu in this stack — say the word. */}
                  roll
                </button>
              </h4>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {items.map((item) => (
                  <ShopBox
                    key={item.id}
                    item={item}
                    worn={loadout[slot]?.item === item.id}
                    affordable={item.price <= balance}
                    slot={slot}
                    onPick={pick}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {hits === 0 && (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
            Nothing matches “{query}”.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-line bg-deck-2/30 px-4 py-3">
        <span className="eyebrow text-ink-3">On the board</span>
        <span className="h-9 w-9 overflow-hidden rounded-full border border-gold/50 bg-deck-2">
          <PixelAvatar loadout={loadout} bust flat className="h-full w-full" />
        </span>
        <span className="h-9 w-9 overflow-hidden rounded-full border border-line bg-deck-2">
          <PixelAvatar loadout={DEFAULT_LOADOUT} bust flat className="h-full w-full" />
        </span>
        <span className="font-mono text-[0.625rem] text-ink-3">yours · a new athlete&rsquo;s</span>
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
const ShopBox = memo(function ShopBox({
  item,
  slot,
  worn,
  affordable,
  onPick,
}: {
  item: AvatarItem;
  slot: Slot;
  worn: boolean;
  affordable: boolean;
  onPick: (slot: Slot, itemId: string) => void;
}) {
  const src = itemImage(item.id);
  const free = STARTER_ITEMS.has(item.id) || item.price === 0;
  const tier = TIER[item.tier];
  return (
    <button
      onClick={() => onPick(slot, item.id)}
      aria-pressed={worn}
      className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition-colors ${
        worn ? "border-gold bg-gold/10" : `${tier.ring} bg-deck-2/40`
      }`}
    >
      <span
        className="relative flex h-[4.5rem] items-center justify-center p-2"
        style={{
          background: [
            tier.glow
              ? `radial-gradient(75% 65% at 50% 55%, color-mix(in srgb, ${tier.glow} 26%, transparent) 0%, transparent 70%)`
              : null,
            "linear-gradient(180deg, color-mix(in srgb, var(--color-ink) 12%, transparent) 0%, transparent 55%, color-mix(in srgb, #000 22%, transparent) 100%)",
          ].filter(Boolean).join(", "),
        }}
      >
        {item.slot === "skin" ? (
          // A skin tone has no sprite to photograph — it IS the colour.
          <span
            aria-hidden
            className="h-11 w-11 rounded-full border-2 border-line"
            style={{ background: `linear-gradient(145deg, ${item.colour} 55%, ${item.accent} 100%)` }}
          />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element -- a generated data: URI, not a file
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className="pixel-avatar h-full w-full object-contain"
          />
        ) : (
          <span className="eyebrow flex h-full w-full items-center justify-center rounded-lg border border-dashed border-line text-[0.5625rem] text-ink-3">
            nothing
          </span>
        )}
        {worn && (
          <span className="eyebrow absolute right-1 top-1 rounded bg-gold px-1.5 py-0.5 text-[0.5rem] text-on-gold">
            worn
          </span>
        )}
      </span>
      <span className="flex min-h-[3.25rem] flex-1 flex-col gap-0.5 border-t border-line/60 px-2 py-1.5">
        {/* The tier gets its own line: "legendary" beside a price doesn't fit a
            third of a phone, and a truncated tier is worse than none. */}
        {tier.tag && (
          <span className="eyebrow text-[0.4375rem]" style={{ color: tier.glow }}>
            {tier.tag}
          </span>
        )}
        <span className="text-[0.6875rem] leading-[1.15] text-ink">{item.label}</span>
        <span className="mt-auto flex items-center gap-1 pt-0.5 font-mono text-[0.625rem]">
          {free ? (
            <span className="text-ink-3">yours</span>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- one cached file, forty boxes */}
              <img
                src="/tri-coin.png"
                alt=""
                aria-hidden
                className={`h-3 w-3 object-contain ${affordable ? "" : "opacity-40"}`}
              />
              {/* Out of reach is worth saying quietly, not hiding. */}
              <span className={affordable ? "text-gold" : "text-ink-3"}>{fmtCoins(item.price)}</span>
            </>
          )}
        </span>
      </span>
    </button>
  );
});
