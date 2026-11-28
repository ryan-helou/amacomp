"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { FESTIVE_KEY, festiveFor } from "@/lib/festive";
import { BackgroundForest, FestiveSky } from "./FestiveScenes";

/**
 * Whether the app is wearing its Christmas look (lib/festive). One value for
 * the whole tree, so the figure's hat, the ring and the snow all agree.
 */
interface Festive {
  on: boolean;
  /** The day the look is showing, for the verse and the special days. */
  day: string;
  /** Easter egg: send the sleigh across the sky. */
  fly: () => void;
  /** Bumps each time the sleigh is sent. */
  sleigh: number;
  /** The admin's preview: "on", "off", or null to follow the date. */
  preview: string | null;
  setPreview: (v: string | null) => void;
}

const Ctx = createContext<Festive>({
  on: false, day: "", fly: () => {}, sleigh: 0, preview: null, setPreview: () => {},
});

export function useFestive(): Festive {
  return useContext(Ctx);
}

export function FestiveProvider({ day, children }: { day: string; children: ReactNode }) {
  // Starts from the date alone, so the first client render matches the
  // server's; the stored preview is applied once mounted.
  const [preview, setPreviewState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading storage after hydration, once
      setPreviewState(localStorage.getItem(FESTIVE_KEY));
    } catch {}
    setLoaded(true);
  }, []);
  const on = festiveFor(day, preview);
  const [sleigh, setSleigh] = useState(0);

  // The stylesheet's half of the look hangs off this attribute.
  // ThemeScript already stamped it before the first paint; only take over once
  // the stored preview is known, or a preview would flicker off and on.
  useEffect(() => {
    if (!loaded) return;
    const root = document.documentElement;
    if (on) root.setAttribute("data-festive", "xmas");
    else root.removeAttribute("data-festive");
  }, [on, loaded]);

  const value = useMemo<Festive>(
    () => ({
      on,
      day,
      sleigh,
      fly: () => setSleigh((n) => n + 1),
      preview,
      setPreview: (v) => {
        try {
          if (v) localStorage.setItem(FESTIVE_KEY, v);
          else localStorage.removeItem(FESTIVE_KEY);
        } catch {}
        setPreviewState(v);
      },
    }),
    [on, day, sleigh, preview],
  );
  return (
    <Ctx.Provider value={value}>
      {on && <BackgroundForest />}
      {children}
      {on && <FestiveSky />}
    </Ctx.Provider>
  );
}

/**
 * Slow snow behind everything. Fixed, never takes a tap, and gone entirely for
 * anyone with reduce-motion on (globals.css). Positions are fixed numbers, not
 * random, so every render draws the same sky.
 */
const FLAKES = Array.from({ length: 36 }, (_, i) => {
  const x = (i * 37) % 100;
  const size = 2 + ((i * 7) % 4);
  const dur = 9 + ((i * 13) % 9);
  const delay = -((i * 29) % 17);
  const drift = ((i * 11) % 30) - 15;
  return { x, size, dur, delay, drift, o: 0.35 + ((i * 5) % 5) / 10 };
});

export function Snowfall() {
  const { on } = useFestive();
  if (!on) return null;
  return <Snow className="fixed z-[5]" />;
}

/** The flakes themselves, for any layer that wants them (the kickoff card). */
export function Snow({ className = "absolute" }: { className?: string }) {
  return (
    <div aria-hidden className={`snowfall pointer-events-none inset-0 overflow-hidden ${className}`}>
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="snowflake"
          style={{
            left: `${f.x}%`,
            width: f.size,
            height: f.size,
            opacity: f.o,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
            ["--drift" as string]: `${f.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

/** A sprig of holly — two leaves and three berries — for the wordmark. */
export function Holly({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className} aria-hidden>
      <path d="M13 11 C9 4 4 4 1 6 C3 7 3 9 2 11 C5 10 6 12 6 14 C8 12 10 13 13 11 Z" fill="#1f7a45" />
      <path d="M15 11 C19 4 24 4 27 6 C25 7 25 9 26 11 C23 10 22 12 22 14 C20 12 18 13 15 11 Z" fill="#2a9a58" />
      <path d="M13 11 C9 7 5 6 2.5 7" stroke="#145232" strokeWidth="0.8" fill="none" />
      <path d="M15 11 C19 7 23 6 25.5 7" stroke="#1a6a3d" strokeWidth="0.8" fill="none" />
      <circle cx="12" cy="12.5" r="2.4" fill="#d42a35" />
      <circle cx="16" cy="12.5" r="2.4" fill="#c21f2b" />
      <circle cx="14" cy="9.6" r="2.4" fill="#e23a44" />
      <circle cx="13.2" cy="8.8" r="0.7" fill="#fff" opacity="0.7" />
    </svg>
  );
}

/** A wrapped present, for a quota met at Christmas. */
export function Gift({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <rect x="2" y="6" width="12" height="9" rx="1" fill="#d42a35" />
      <rect x="1" y="4" width="14" height="3" rx="1" fill="#e23a44" />
      <rect x="7" y="4" width="2" height="11" fill="#f2c94c" />
      <path d="M8 4 C6 1 3 1.5 4 3.5 C4.6 4.3 6.5 4.2 8 4 Z M8 4 C10 1 13 1.5 12 3.5 C11.4 4.3 9.5 4.2 8 4 Z" fill="#f2c94c" />
    </svg>
  );
}

/**
 * The admin's preview of the Christmas look, in Settings. Kept on this phone
 * only — nobody else sees it until Dec 7.
 */
export function FestivePreview() {
  const { preview, setPreview } = useFestive();
  const modes: { id: string | null; label: string }[] = [
    { id: null, label: "Auto" },
    { id: "on", label: "On" },
    { id: "off", label: "Off" },
  ];
  return (
    <div className="pane mt-4 rounded-xl border border-line bg-tile px-4 py-3">
      <div className="flex items-center gap-2">
        <Holly className="h-3.5 w-5" />
        <span className="eyebrow text-ink">Christmas look</span>
      </div>
      <p className="mt-0.5 text-[0.8125rem] text-ink-2">
        Turns on by itself Dec 7 – Jan 6. Preview it here; only your phone sees the preview.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {modes.map((m) => {
          const active = preview === m.id || (m.id === null && preview !== "on" && preview !== "off");
          return (
            <button
              key={m.label}
              type="button"
              aria-pressed={active}
              onClick={() => setPreview(m.id)}
              className={`rounded-xl border px-2 py-2 font-display text-[0.6875rem] font-bold uppercase tracking-[0.06em] ${
                active ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
