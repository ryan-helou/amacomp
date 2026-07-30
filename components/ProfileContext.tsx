"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import { AthleteSheet } from "./AthleteSheet";

/**
 * One shared profile sheet for the whole app. Any component can call
 * `useOpenProfile()(id)` to pop someone's card — the sheet is rendered once here
 * so a name is tappable wherever it appears, not just on the Board.
 */
const OpenProfileCtx = createContext<(athleteId: string) => void>(() => {});
// The reigning champion (last season's winner) — shown in gold everywhere.
const ChampionCtx = createContext<string | null>(null);

export function useOpenProfile() {
  return useContext(OpenProfileCtx);
}

export function useReigningChampion() {
  return useContext(ChampionCtx);
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
  return (
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
