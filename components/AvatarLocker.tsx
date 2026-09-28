"use client";

import { useState } from "react";
import { AVATAR_ITEMS, DEFAULT_LOADOUT, type Loadout, type Slot } from "@/lib/pixelAvatar";
import { PixelAvatar } from "./PixelAvatar";

const SLOTS: Slot[] = ["head", "eyes", "torso", "legs", "feet", "socks", "watch"];
const PALETTE = ["#d4147e", "#16d39a", "#5f9a12", "#00c6c8", "#c9a227", "#f3f3f1", "#20242b", "#ff7a29"];

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
];

/**
 * The locker, Ryan's preview only (see `canPreviewAvatar`).
 *
 * Nothing here is saved yet: it exists so the figure can be judged at real size,
 * on a real phone, against the app's own background rather than in a mock.
 */
export function AvatarLocker() {
  const [loadout, setLoadout] = useState<Loadout>(KITS[0].loadout);
  const [slot, setSlot] = useState<Slot>("head");
  const [view, setView] = useState<"front" | "back">("front");

  const worn = loadout[slot];
  const options = AVATAR_ITEMS.filter((i) => i.slot === slot);

  return (
    <section className="rounded-2xl pane border border-gold/40 bg-tile px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="stamp text-lg text-gold">LOCKER</h3>
        <span className="eyebrow text-ink-3">Yours only · not saved yet</span>
      </div>

      <div className="mt-3 flex items-start gap-4">
        <button
          onClick={() => setView(view === "front" ? "back" : "front")}
          aria-label="Turn the figure around"
          className="shrink-0 rounded-xl border border-line bg-deck-2/40 px-2 py-2"
        >
          <PixelAvatar loadout={loadout} view={view} className="w-24" />
          <span className="eyebrow mt-1 block text-center text-ink-3">
            {view === "front" ? "Front" : "Back"}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1">
            {KITS.map((k) => (
              <button
                key={k.name}
                onClick={() => setLoadout(k.loadout)}
                className="eyebrow rounded-full border border-line px-2.5 py-1.5 text-ink-2"
              >
                {k.name}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {SLOTS.map((s) => (
              <button
                key={s}
                onClick={() => setSlot(s)}
                aria-pressed={slot === s}
                className={`eyebrow rounded-lg px-2 py-1.5 ${
                  slot === s ? "bg-ink text-on-ink" : "text-ink-3"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => setLoadout({ ...loadout, [slot]: { ...worn, item: o.id } })}
                aria-pressed={worn?.item === o.id}
                className={`rounded-lg border px-2 py-1.5 text-[0.6875rem] ${
                  worn?.item === o.id ? "border-gold text-ink" : "border-line text-ink-2"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setLoadout({ ...loadout, [slot]: { ...worn, colour: c } })}
                aria-label={`Colour ${c}`}
                className={`h-6 w-6 rounded-md border-2 ${
                  worn?.colour === c ? "border-ink" : "border-transparent"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
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
