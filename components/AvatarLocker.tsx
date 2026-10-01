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
import type { League } from "./useLeague";
import { PixelAvatar } from "./PixelAvatar";
import { CountryFlag } from "./CountryFlag";
import { flagLane } from "@/lib/flags";

// You first, then what you put on, then what flies behind you.
const SLOTS: Slot[] = [
  "skin", "hair", "face",
  "head", "eyes", "torso", "legs", "feet", "prize", "flag",
];

const SHELF: Record<Slot, string> = {
  skin: "Skin",
  hair: "Hair",
  face: "Face",
  flag: "Flags",
  head: "Headwear",
  eyes: "Eyewear",
  torso: "Tops",
  legs: "Bottoms",
  feet: "Shoes",
  prize: "Trophies",
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
export function AvatarLocker({
  state,
  refDay,
  send,
}: {
  state: AppState;
  refDay: DayKey;
  send: League["send"];
}) {
  /**
   * What he's wearing. In a piece of state of its own so the callbacks the
   * boxes get can be created once and never change — 150 boxes re-rendering
   * for a change that touches one of them cost 563ms on a throttled phone.
   */
  const [loadout, setFit] = useState<Loadout>(DEFAULT_LOADOUT);
  /** The item the till is asking about, then working on. */
  const [asking, setAsking] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Headwear, not Skin: you open the shop to dress, and your face is already
  // sorted. The You shelves are a tap away on the same row.
  const [tab, setTab] = useState<Slot>("head");

  // The last outfit comes back on reload — this thing gets opened a hundred times
  // in a row while the art is being judged. Per-browser only, and never required.
  useEffect(() => {
    // What the server has is the real outfit; the local copy is only a
    // convenience for someone who hasn't saved yet.
    if (state.myLoadout) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, restoring the saved outfit
      setFit({ ...DEFAULT_LOADOUT, ...state.myLoadout });
      return;
    }
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setFit(JSON.parse(raw) as Loadout);
    } catch {
      /* private window, blocked storage: the default kit is fine */
    }
  }, [state.myLoadout]);

  // Saved after the fact, so the setters above stay pure.
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(loadout));
    } catch {
      /* the figure still changes */
    }
  }, [loadout]);

  const wear = useCallback((next: Loadout) => setFit(next), []);

  const pick = useCallback((slot: Slot, itemId: string) => {
    setFit((f) => ({ ...f, [slot]: { item: itemId } }));
  }, []);

  // What he can actually spend: earned, plus anything granted, less what the
  // shop has already taken.
  const account = coinAccount(
    state.me?.id ?? "", state.athletes, state.activities, state.settings, refDay,
    state.coinGrants, state.purchases,
  );
  const balance = account.balance;

  /** What he owns: the starter kit, plus everything he's paid for. */
  const owned = new Set([
    ...STARTER_ITEMS,
    ...state.purchases.filter((p) => p.athleteId === state.me?.id).map((p) => p.itemId),
  ]);

  async function buy(itemId: string) {
    setPaying(itemId);
    setProblem(null);
    // The balance and the owned list come back in the state the till returns,
    // so nothing here has to guess what the purchase did.
    const error = await send("/api/club", { method: "POST", body: JSON.stringify({ buy: itemId }) });
    setPaying(null);
    if (error) {
      setProblem(error);
      return;
    }
    const item = AVATAR_ITEM_BY_ID.get(itemId);
    if (item) pick(item.slot, item.id); // you bought it to wear it
    setAsking(null);
  }

  async function save() {
    setPaying("save");
    setProblem(await send("/api/club", { method: "POST", body: JSON.stringify({ wear: loadout }) }));
    setPaying(null);
  }

  // What this outfit would cost someone who only has the starter kit.
  const bill = SLOTS.reduce((sum, slot) => {
    const worn = loadout[slot];
    if (!worn || owned.has(worn.item)) return sum;
    return sum + (AVATAR_ITEM_BY_ID.get(worn.item)?.price ?? 0);
  }, 0);

  // Worn = anything that isn't the slot's default, which is what the take-off
  // strip lists. It can't be "anything that cost coins": a prize is free and
  // certainly on, and a strip that can't list it can't take it off either.
  const worn = SLOTS.flatMap((slot) => {
    const item = AVATAR_ITEM_BY_ID.get(loadout[slot]?.item ?? "");
    if (!item || item.id === DEFAULT_LOADOUT[slot]?.item) return [];
    return [{ slot, item }];
  });

  const flying = AVATAR_ITEM_BY_ID.get(loadout.flag?.item ?? "");
  const askedItem = asking ? AVATAR_ITEM_BY_ID.get(asking) : undefined;
  // The flag you fly is also the lane behind your row: one country, one buy.
  const lane = flagLane(flying?.flag ?? "");

  /** Things on the figure that he hasn't paid for — a fitting, not a fit. */
  const tryingOn = SLOTS.filter((slot) => {
    const worn = loadout[slot];
    if (!worn) return false;
    const item = AVATAR_ITEM_BY_ID.get(worn.item);
    // Free kit and prizes aren't a fitting — there's nothing left to pay.
    return !!item && item.price > 0 && !owned.has(item.id);
  }).length;

  const needle = query.trim().toLowerCase();

  /** What a shelf shows: everything, or just what matches the search. */
  function shown(slot: Slot): AvatarItem[] {
    if (!needle) return rackFor(slot);
    return rackFor(slot).filter((item) => item.label.toLowerCase().includes(needle));
  }

  const shelves = SLOTS.map((slot) => ({ slot, items: shown(slot) })).filter((s) => s.items.length > 0);

  // Searching looks everywhere — you shouldn't have to guess which tab
  // "canada" is on. Otherwise you see the tab you picked.
  const showing = needle ? shelves : shelves.filter((sh) => sh.slot === tab);

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
          <span className="eyebrow flex items-center gap-1.5 text-ink-3">
            {state.me?.name}
            {flying?.flag && <CountryFlag id={flying.flag} />}
            <span>· not saved yet</span>
          </span>
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
                className="pointer-events-none absolute inset-x-5 bottom-[1.1rem] h-2 rounded-[50%]"
                style={{ background: "radial-gradient(50% 100% at 50% 50%, rgba(0,0,0,0.5), transparent 72%)" }}
              />
              <PixelAvatar
                loadout={loadout}
                view={view}
                className="relative mx-auto w-full max-w-[6.75rem] px-2 pt-1.5"
              />
              <span className="eyebrow relative block pb-1 text-center text-[0.5rem] text-ink-3">
                {view}
              </span>
            </div>
          ))}
        </div>

        {/* The till on one line: he opened the shop to shop, not to read. */}
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-deck-2/50 px-3 py-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- one cached file */}
          <img src="/tri-coin.png" alt="" aria-hidden className="h-4 w-4 shrink-0 object-contain" />
          <span className="stamp text-sm leading-none tabular-nums text-gold">{fmtCoins(balance)}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[0.625rem] text-ink-3">
            {tryingOn > 0
              ? `trying on ${tryingOn} · ${fmtCoins(bill)} to keep`
              : "all yours"}
          </span>
          <button
            onClick={save}
            disabled={paying === "save"}
            className="eyebrow shrink-0 rounded-lg border border-gold/50 bg-gold/10 px-2.5 py-1 text-[0.5625rem] text-gold disabled:opacity-40"
          >
            {paying === "save" ? "saving" : "save"}
          </button>
        </div>
        {/* Your row on the Week tab, washed by the lane you've picked — the
            same flagWash the app already uses for an away week. */}
        <div
          className="mt-2 flex items-center gap-2 overflow-hidden rounded-xl border border-line px-2.5 py-2"
          style={lane ? (lane as React.CSSProperties) : { background: "var(--color-deck-2)" }}
        >
          <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-line bg-deck-2">
            <PixelAvatar loadout={loadout} bust flat className="h-full w-full" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="truncate text-[0.8125rem] text-ink">{state.me?.name}</span>
            {flying?.flag && <CountryFlag id={flying.flag} />}
          </span>
          <span className="shrink-0 font-mono text-[0.6875rem] text-ink-2">105.1/100</span>
        </div>


      </div>

      {/* Pinned while you browse: what you're wearing, a search, and a tab per
          shelf. It stays put so you can see what you've done without scrolling
          back up. */}
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
        </div>
        {/* One tap per category, and the row stays put while you browse. The
            shop used to be one scroll of a hundred and fifty boxes. */}
        <div
          role="tablist"
          aria-label="Shop categories"
          className="mt-1.5 -mx-2 flex gap-1 overflow-x-auto px-2 pb-0.5"
        >
          {SLOTS.map((slot) => {
            const n = rackFor(slot).length;
            const open = !needle && slot === tab;
            return (
              <button
                key={slot}
                role="tab"
                aria-selected={open}
                id={`tab-${slot}`}
                onClick={(e) => {
                  setTab(slot);
                  setQuery("");
                  // Thirteen tabs don't fit a phone, so the one you picked
                  // walks itself into the middle of the row.
                  const el = e.currentTarget;
                  const row = el.parentElement;
                  if (row) {
                    row.scrollTo({
                      left: el.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2,
                      behavior: "smooth",
                    });
                  }
                }}
                className={`eyebrow shrink-0 rounded-full border px-2.5 py-1 text-[0.5625rem] transition-colors ${
                  open
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-line bg-deck-2/40 text-ink-2"
                }`}
              >
                {SHELF[slot]} <span className={open ? "text-gold/70" : "text-ink-3"}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-5 px-3 py-4">
        {showing.map(({ slot, items }) => {
          // A visor IS the eyewear, so say so rather than leaving a shelf of
          // boxes that quietly do nothing.
          const hidden =
            slot === "eyes" && AVATAR_ITEM_BY_ID.get(loadout.head?.item ?? "")?.coversEyes;
          return (
            <section
              key={slot}
              id={`shelf-${slot}`}
              className={hidden ? "opacity-40" : ""}
              // Shelves off-screen skip layout — a hundred and fifty boxes is
              // a lot of it — and reserve the height they'll need so scrolling
              // and the jump chips land where they say they will.
              style={{
                contentVisibility: "auto",
                containIntrinsicSize: `auto ${36 + Math.ceil(items.length / 3) * 170}px`,
              }}
            >
              <h4 className="flex items-center gap-2">
                <span className="eyebrow shrink-0 text-ink-2">
                  {SHELF[slot]} <span className="text-ink-3">{items.length}</span>
                </span>
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
                    slot={slot}
                    owned={owned.has(item.id) || item.price === 0}
                    affordable={item.price <= balance}
                    onPick={pick}
                    onAsk={setAsking}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {showing.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
            Nothing matches “{query}”.
          </p>
        )}
      </div>

      {worn.length > 0 && (
        <div className="border-t border-line px-3 py-3">
          <h4 className="eyebrow text-ink-3">Wearing</h4>
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            {worn.map(({ slot, item }) => (
              <button
                key={slot}
                onClick={() => {
                  const bare = rackFor(slot).find((i) => i.price === 0 && !i.sprite)
                    ?? rackFor(slot).find((i) => i.price === 0);
                  if (bare) wear({ ...loadout, [slot]: { item: bare.id } });
                }}
                aria-label={`Take off ${item.label}`}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-deck-2/40 px-2 py-1 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-[0.625rem] text-ink-2">{item.label}</span>
                <span aria-hidden className="shrink-0 text-[0.75rem] leading-none text-ink-3">×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {askedItem && (
        <BuySheet
          item={askedItem}
          balance={balance}
          paying={paying === askedItem.id}
          problem={problem}
          onClose={() => {
            setAsking(null);
            setProblem(null);
          }}
          onBuy={() => buy(askedItem.id)}
        />
      )}

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
  owned,
  affordable,
  onPick,
  onAsk,
}: {
  item: AvatarItem;
  slot: Slot;
  worn: boolean;
  owned: boolean;
  affordable: boolean;
  onPick: (slot: Slot, itemId: string) => void;
  /** Opens the till for something you don't own yet. */
  onAsk: (itemId: string) => void;
}) {
  const src = itemImage(item.id);
  const free = owned;
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
        {item.flag ? (
          <CountryFlag id={item.flag} className="h-9 w-[3.375rem] shadow-sm" />
        ) : item.slot === "skin" ? (
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
          {item.earned ? (
            // Not a button: there is no transaction to open. It says what the
            // thing costs, and what it costs is a result.
            <span className="flex w-full items-center justify-center gap-1 rounded border border-gold/40 bg-gold/5 px-1 py-0.5 text-[0.5625rem] text-gold/80">
              {item.earned}
            </span>
          ) : free ? (
            <span className="text-ink-3">yours</span>
          ) : (
            // Trying it on is a tap on the box; buying it is a tap on this.
            // They're different decisions, so they're different targets.
            <span
              role="button"
              tabIndex={0}
              aria-label={`Buy ${item.label} for ${item.price} coins`}
              onClick={(e) => {
                e.stopPropagation();
                onAsk(item.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onAsk(item.id);
                }
              }}
              className={`flex w-full items-center justify-center gap-1 rounded border px-1 py-0.5 ${
                affordable ? "border-gold/50 bg-gold/10 text-gold" : "border-line text-ink-3"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- one cached file, many boxes */}
              <img
                src="/tri-coin.png"
                alt=""
                aria-hidden
                className={`h-3 w-3 object-contain ${affordable ? "" : "opacity-40"}`}
              />
              {fmtCoins(item.price)}
            </span>
          )}
        </span>
      </span>
    </button>
  );
});

/**
 * The till, as a sheet.
 *
 * A purchase is the one thing in here that can't be undone with another tap,
 * so it gets a moment of its own: the thing, what it costs, what you'll have
 * left, and a button that says the number out loud.
 */
function BuySheet({
  item,
  balance,
  paying,
  problem,
  onClose,
  onBuy,
}: {
  item: AvatarItem;
  balance: number;
  paying: boolean;
  problem: string | null;
  onClose: () => void;
  onBuy: () => void;
}) {
  const src = itemImage(item.id);
  const affordable = item.price <= balance;
  const after = balance - item.price;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-scrim" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Buy ${item.label}`}
        className="relative glass-raised rounded-t-3xl border-t border-line-2 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-ink-3" />

        <div className="flex items-center gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-line bg-deck-2/60 p-2">
            {item.flag ? (
              <CountryFlag id={item.flag} className="h-8 w-12" />
            ) : item.slot === "skin" ? (
              <span
                aria-hidden
                className="h-10 w-10 rounded-full border-2 border-line"
                style={{ background: `linear-gradient(145deg, ${item.colour} 55%, ${item.accent} 100%)` }}
              />
            ) : src ? (
              // eslint-disable-next-line @next/next/no-img-element -- a generated data: URI
              <img src={src} alt="" className="pixel-avatar h-full w-full object-contain" />
            ) : null}
          </span>
          <span className="min-w-0">
            {TIER[item.tier].tag && (
              <span className="eyebrow block text-[0.5rem]" style={{ color: TIER[item.tier].glow }}>
                {TIER[item.tier].tag}
              </span>
            )}
            <span className="block text-base text-ink">{item.label}</span>
            <span className="flex items-center gap-1 font-mono text-xs text-ink-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- one cached file */}
              <img src="/tri-coin.png" alt="" aria-hidden className="h-3.5 w-3.5 object-contain" />
              <span className="text-gold">{fmtCoins(item.price)}</span>
            </span>
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-deck-2/40 px-3 py-2 font-mono text-xs">
          <span className="text-ink-3">
            you have <span className="text-ink-2">{fmtCoins(balance)}</span>
          </span>
          <span className={affordable ? "text-ink-3" : "text-run"}>
            {affordable ? (
              <>
                after <span className="text-gold">{fmtCoins(after)}</span>
              </>
            ) : (
              <>{fmtCoins(item.price - balance)} short</>
            )}
          </span>
        </div>

        {problem && (
          <p className="mt-2 rounded-lg border border-run/40 bg-run/10 px-3 py-2 text-center font-mono text-[0.6875rem] text-run">
            {problem}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="eyebrow flex-1 rounded-xl border border-line py-3 text-ink-2"
          >
            Cancel
          </button>
          <button
            onClick={onBuy}
            disabled={!affordable || paying}
            className="eyebrow flex-[2] rounded-xl bg-gold py-3 text-on-gold disabled:opacity-40"
          >
            {paying ? "Buying…" : affordable ? `Buy for ${fmtCoins(item.price)}` : "Not enough coins"}
          </button>
        </div>
      </div>
    </div>
  );
}
