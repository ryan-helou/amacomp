"use client";

import { useEffect, useState } from "react";

/**
 * Light or dark. The only two schemes.
 *
 * Both are the same design — black, grey and white, with the four disciplines
 * carrying the only colour — so the swatch shows the ground and those four
 * colours rather than an accent: they are the only thing that actually moves
 * between the two.
 *
 * The value is written straight onto the html element so the change is
 * immediate, and to localStorage so ThemeScript can replay it before the next
 * first paint. With nothing saved the phone's own setting decides.
 */

const MODES = [
  {
    id: "light",
    label: "Light",
    deck: "#f4f4f5",
    ink: "#101112",
    sports: ["#0a9a70", "#5f9a12", "#d4147e", "#00868c"],
  },
  {
    id: "dark",
    label: "Dark",
    deck: "#101112",
    ink: "#f1f2f3",
    sports: ["#16d39a", "#9ad21f", "#ff3aa5", "#00c6c8"],
  },
] as const;

const STORAGE_KEY = "amacomp-palette";

export function PalettePicker() {
  const [active, setActive] = useState<string>("light");

  useEffect(() => {
    // Read back what ThemeScript already stamped, so the picker agrees with the
    // screen on the very first render rather than showing Light as selected
    // while the app is plainly dark.
    const dark = document.documentElement.getAttribute("data-palette") === "dark";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, reading what the pre-paint script applied
    setActive(dark ? "dark" : "light");
  }, []);

  function choose(id: string) {
    setActive(id);
    const root = document.documentElement;
    // Light is the stylesheet's base, so it is the ABSENCE of the attribute.
    if (id === "dark") root.setAttribute("data-palette", "dark");
    else root.removeAttribute("data-palette");
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* the choice still applies for this session */
    }
  }

  return (
    <div className="pane mt-4 rounded-xl border border-line bg-tile px-4 py-3">
      <div className="eyebrow text-ink">Appearance</div>
      <p className="mt-0.5 text-[0.8125rem] text-ink-2">
        The app is black, grey and white — the sports carry the colour.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {MODES.map((m) => {
          const on = m.id === active;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => choose(m.id)}
              aria-pressed={on}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-transform active:scale-95 ${
                on ? "border-accent bg-accent-soft" : "border-line"
              }`}
            >
              <span
                aria-hidden
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg"
                style={{ backgroundColor: m.deck, boxShadow: `inset 0 0 0 1px ${m.ink}22` }}
              >
                {m.sports.map((hex) => (
                  <span
                    key={hex}
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </span>
              <span
                className={`font-display text-[0.625rem] font-bold uppercase leading-none tracking-[0.06em] ${
                  on ? "text-ink" : "text-ink-3"
                }`}
              >
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
