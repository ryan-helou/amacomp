"use client";

import { useEffect, useState } from "react";

/**
 * The colourway picker.
 *
 * Only the ground and the accent move between schemes — the four discipline
 * colours are identity, not decoration, so swim stays blue and run stays red
 * whatever else changes. That is why each swatch shows the deck it paints and
 * the accent it acts with, and nothing else: those are the only two things a
 * reader is actually choosing between.
 *
 * The value is written straight onto the html element so the change is
 * immediate, and to localStorage so ThemeScript can replay it before the next
 * first paint.
 */

const PALETTES = [
  { id: "deck", label: "Deck", deck: "#c2d5de", accent: "#2f4be8", accent2: "#7b31e0" },
  { id: "slate", label: "Slate", deck: "#ccd2da", accent: "#3b57d6", accent2: "#7145d8" },
  { id: "carbon", label: "Carbon", deck: "#2b3138", accent: "#7d95ff", accent2: "#b98cff" },
  { id: "clay", label: "Clay", deck: "#dbc9bd", accent: "#b8471f", accent2: "#d97316" },
  { id: "moss", label: "Moss", deck: "#c7d1bc", accent: "#3f7a34", accent2: "#6d9c1f" },
  { id: "plum", label: "Plum", deck: "#cec5db", accent: "#6d34c8", accent2: "#b1349b" },
  // The two monochrome schemes: the app goes black, grey and white, and the
  // only colour left is the four disciplines — so their swatch shows those.
  { id: "soot", label: "Soot", deck: "#151617", accent: "#2fd0a0", accent2: "#ff2e9a" },
  { id: "void", label: "Void", deck: "#000000", accent: "#00c46a", accent2: "#ff3db0" },
] as const;

const STORAGE_KEY = "amacomp-palette";

export function PalettePicker() {
  const [active, setActive] = useState<string>("deck");

  useEffect(() => {
    // Read back what ThemeScript already stamped, so the picker agrees with the
    // screen on the very first render rather than briefly showing Deck as
    // selected while the app is plainly some other colour.
    let saved = "deck";
    try {
      saved = localStorage.getItem(STORAGE_KEY) ?? "deck";
    } catch {
      /* private mode — the default is the honest answer */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, reading what the pre-paint script applied
    setActive(PALETTES.some((p) => p.id === saved) ? saved : "deck");
  }, []);

  function choose(id: string) {
    setActive(id);
    const root = document.documentElement;
    // Deck is the stylesheet's base, so it is the ABSENCE of the attribute.
    if (id === "deck") root.removeAttribute("data-palette");
    else root.setAttribute("data-palette", id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* the choice still applies for this session */
    }
  }

  return (
    <div className="pane mt-4 rounded-xl border border-line bg-tile px-4 py-3">
      <div className="eyebrow text-ink">Colourway</div>
      <p className="mt-0.5 text-[0.8125rem] text-ink-2">
        Changes the deck and the accent. Soot and Void also recolour the sports.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {PALETTES.map((p) => {
          const on = p.id === active;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(p.id)}
              aria-pressed={on}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-transform active:scale-95 ${
                on ? "border-accent bg-accent-soft" : "border-line"
              }`}
            >
              <span
                aria-hidden
                className="flex h-7 w-full items-center justify-center rounded-lg"
                style={{ backgroundColor: p.deck }}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{
                    backgroundImage: `linear-gradient(130deg, ${p.accent}, ${p.accent2})`,
                  }}
                />
              </span>
              <span
                className={`font-display text-[0.625rem] font-bold uppercase leading-none tracking-[0.06em] ${
                  on ? "text-ink" : "text-ink-3"
                }`}
              >
                {p.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
