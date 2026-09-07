"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import { awayThisWeek, type Flag } from "@/lib/away";
import { AthleteSheet } from "./AthleteSheet";

/**
 * One shared profile sheet for the whole app. Any component can call
 * `useOpenProfile()(id)` to pop someone's card — the sheet is rendered once here
 * so a name is tappable wherever it appears, not just on the Board.
 */
const OpenProfileCtx = createContext<(athleteId: string) => void>(() => {});
// The reigning champion (last season's winner) — shown in gold everywhere.
const ChampionCtx = createContext<string | null>(null);
// Anyone away this week, with the flag to fly for them.
const AwayCtx = createContext<Map<string, Flag>>(new Map());

export function useOpenProfile() {
  return useContext(OpenProfileCtx);
}

export function useReigningChampion() {
  return useContext(ChampionCtx);
}

export function useAway() {
  return useContext(AwayCtx);
}

export function ProfileProvider({
  state,
  refDay,
  championId = null,
  children,
}: {
  state: AppState;
  refDay: DayKey;
  championId?: string | null;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  // Recomputed from the log, so a week ends and the flag comes down on its own.
  const away = useMemo(
    () => awayThisWeek(state.activities, refDay),
    [state.activities, refDay],
  );
  return (
    <AwayCtx.Provider value={away}>
    <ChampionCtx.Provider value={championId}>
      <OpenProfileCtx.Provider value={setSelected}>
        {children}
        {selected && (
          <AthleteSheet
            state={state}
            athleteId={selected}
            refDay={refDay}
            reigning={championId}
            onClose={() => setSelected(null)}
          />
        )}
      </OpenProfileCtx.Provider>
    </ChampionCtx.Provider>
    </AwayCtx.Provider>
  );
}

/**
 * A name flying a flag: a solid two-colour gradient with a white band sweeping
 * across it.
 *
 * The white is a separate sheen layer rather than a stop in the gradient
 * underneath. Painting white into the middle of the gradient makes the middle of
 * the name vanish against a pale deck; as a moving highlight it reads as a flag
 * rippling and the text stays legible at every frame.
 */
export function FlagName({
  name,
  flag,
  className,
}: {
  name: string;
  flag: Flag;
  className?: string;
}) {
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <span
        style={{
          backgroundImage: `linear-gradient(95deg, ${flag.from} 0%, ${flag.from} 38%, ${flag.to} 62%, ${flag.to} 100%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {name}
      </span>
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.72) 50%, transparent 58%)",
          backgroundSize: "300% 100%",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          animation: "flag-sheen 2.6s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        }}
      >
        {name}
      </span>
    </span>
  );
}

/**
 * The little striped tag that sits beside an away athlete's name.
 *
 * The name alone is coloured text, which could be anything; three stripes and a
 * country make it unmistakable. Drawn rather than an emoji flag — those render
 * differently on every platform and Ryan doesn't want emoji in the UI.
 */
export function FlagTag({ flag }: { flag: Flag }) {
  return (
    <span
      className="ml-1.5 inline-flex h-3 w-[1.125rem] shrink-0 overflow-hidden rounded-[3px] align-middle shadow-sm ring-1 ring-black/10"
      title={`Away in ${flag.label}`}
      aria-label={`Away in ${flag.label}`}
      role="img"
    >
      <span className="flex-1" style={{ backgroundColor: flag.from }} />
      <span className="flex-1" style={{ backgroundColor: flag.mid }} />
      <span className="flex-1" style={{ backgroundColor: flag.to }} />
    </span>
  );
}

/**
 * A person's name, tappable to open their profile. Renders as a role="button"
 * span (not a <button>) so it's valid even nested inside another clickable row —
 * the click is stopped from bubbling so it opens the profile, not the row.
 */
export function AthleteName({
  id,
  name,
  className,
}: {
  id: string;
  name: string;
  className?: string;
}) {
  const open = useOpenProfile();
  const champ = useReigningChampion();
  const gold = !!id && champ === id;
  const flag = useAway().get(id);

  // Away: the name flies their flag. Two layers, the same trick the season
  // kickoff card uses — a solid two-colour gradient underneath so the text is
  // always readable, and a white band sweeping across on top. Painting white
  // into the gradient itself would make the middle of the name vanish against a
  // pale deck; as a moving sheen it reads as a flag rippling instead.
  if (flag) {
    return (
      <span
        role="button"
        tabIndex={0}
        aria-label={`${name} — away in ${flag.label} this week`}
        onClick={(e) => {
          e.stopPropagation();
          open(id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            open(id);
          }
        }}
        className={`cursor-pointer font-semibold active:opacity-60 ${className ?? ""}`}
      >
        <FlagName name={name} flag={flag} />
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        open(id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          open(id);
        }
      }}
      // Reigning champion's name is gilded (inline colour beats any text-* class).
      style={gold ? { color: "var(--color-gold)" } : undefined}
      className={`cursor-pointer underline-offset-2 hover:underline active:opacity-60 ${
        gold ? "font-semibold" : ""
      } ${className ?? ""}`}
    >
      {name}
    </span>
  );
}
