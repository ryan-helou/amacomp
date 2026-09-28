"use client";

import { useEffect, useState } from "react";
import {
  AVATAR_ITEMS,
  AVATAR_ITEM_BY_ID,
  DEFAULT_LOADOUT,
  usesAccent,
  type Loadout,
  type Slot,
} from "@/lib/pixelAvatar";
import { PixelAvatar } from "./PixelAvatar";

const SLOTS: Slot[] = ["head", "eyes", "torso", "legs", "feet", "socks", "watch"];
const PALETTE = ["#d4147e", "#16d39a", "#5f9a12", "#00c6c8", "#c9a227", "#f3f3f1", "#20242b", "#ff7a29"];

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
      head: { item: "head.helmet", colour: "#d4147e", accent: "#f3f3f1" },
      eyes: { item: "eyes.shades", colour: "#20242b" },
      torso: { item: "torso.jersey", colour: "#d4147e", accent: "#f3f3f1" },
      legs: { item: "legs.bibs", colour: "#20242b" },
      feet: { item: "feet.bikeshoes", colour: "#f3f3f1", accent: "#d4147e" },
      socks: { item: "socks.tall", colour: "#f3f3f1" },
      watch: { item: "watch.on", colour: "#20242b", accent: "#16d39a" },
    },
  },
  {
    name: "Run",
    loadout: {
      head: { item: "head.runcap", colour: "#16d39a" },
      eyes: { item: "eyes.shades", colour: "#20242b" },
      torso: { item: "torso.tee", colour: "#16d39a", accent: "#f3f3f1" },
      legs: { item: "legs.runshorts", colour: "#20242b" },
      feet: { item: "feet.runshoes", colour: "#f3f3f1", accent: "#16d39a" },
      socks: { item: "socks.short", colour: "#f3f3f1" },
      watch: { item: "watch.on", colour: "#20242b", accent: "#16d39a" },
    },
  },
  {
    name: "Swim",
    loadout: {
      head: { item: "head.swimcap", colour: "#00c6c8" },
      eyes: { item: "eyes.goggles", colour: "#20242b", accent: "#9fdfe4" },
      torso: { item: "torso.bare", colour: "#00c6c8" },
      legs: { item: "legs.jammers", colour: "#20242b" },
      feet: { item: "feet.barefoot", colour: "#f3f3f1" },
      socks: { item: "socks.none", colour: "#f3f3f1" },
      watch: { item: "watch.on", colour: "#20242b", accent: "#00c6c8" },
    },
  },
  {
    name: "Race",
    loadout: {
      head: { item: "head.aero", colour: "#20242b", accent: "#c9a227" },
      eyes: { item: "eyes.none", colour: "#20242b" },
      torso: { item: "torso.trisuit", colour: "#20242b", accent: "#c9a227" },
      legs: { item: "legs.bibs", colour: "#20242b" },
      feet: { item: "feet.carbon", colour: "#c9a227", accent: "#20242b" },
      socks: { item: "socks.short", colour: "#20242b" },
      watch: { item: "watch.on", colour: "#20242b", accent: "#c9a227" },
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
 * rack and both its colours are on screen at once, so any change is one tap, and
 * front and back are both drawn so nothing has to be toggled to be checked.
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

  const set = (slot: Slot, patch: Partial<Loadout[string]>) =>
    wear({ ...loadout, [slot]: { ...loadout[slot], ...patch } });

  function surprise() {
    const next: Loadout = {};
    for (const slot of SLOTS) {
      const rack = AVATAR_ITEMS.filter((i) => i.slot === slot);
      const pick = rack[Math.floor(Math.random() * rack.length)];
      next[slot] = {
        item: pick.id,
        colour: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        accent: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      };
    }
    wear(next);
  }

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

      <div className="mt-3 flex flex-wrap gap-1.5 px-1">
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
          const accent = usesAccent(worn?.item ?? "");
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
                      onClick={() => set(slot, { item: o.id })}
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
                {/* Squares are the main colour; circles the trim, and the trim
                    row appears only where the sprite actually has one. Two lines
                    of eight, because sixteen swatches don't fit a phone. */}
                <div className="mt-1.5 flex items-center gap-1">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => set(slot, { colour: c })}
                      aria-label={`${slot} colour ${c}`}
                      className={`h-5 w-5 rounded-sm border-2 ${
                        worn?.colour === c ? "border-ink" : "border-transparent"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                {accent && (
                  <div className="mt-1 flex items-center gap-1">
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => set(slot, { accent: c })}
                        aria-label={`${slot} accent ${c}`}
                        className={`h-5 w-5 rounded-full border-2 ${
                          worn?.accent === c ? "border-ink" : "border-transparent"
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                    <span className="eyebrow ml-1 text-ink-3">trim</span>
                  </div>
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
