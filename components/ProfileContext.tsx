"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Activity, AppState, Athlete } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import { awayThisWeek, MAPLE, MAPLE_BOX, type Flag } from "@/lib/away";
import { AthleteSheet } from "./AthleteSheet";

/**
 * One shared profile sheet for the whole app. Any component can call
 * `useOpenProfile()(id)` to pop someone's card — the sheet is rendered once here
 * so a name is tappable wherever it appears, not just on the Board.
 */
const OpenProfileCtx = createContext<(athleteId: string) => void>(() => {});
// The reigning champion (last season's winner) — shown in gold everywhere.
const ChampionCtx = createContext<string | null>(null);
// The log itself, so a view can ask who was away in the week IT is showing.
// Deliberately not a prebaked "away this week" map: a flag belongs to a week,
// and a map keyed only by athlete flies it in every view that draws a name —
// the record book, the hall of fame, the titles page, last week's recap. The
// week has to be part of the question.
const EMPTY_LOG: { activities: Activity[]; athletes: Athlete[] } = { activities: [], athletes: [] };
const AwayLogCtx = createContext(EMPTY_LOG);

export function useOpenProfile() {
  return useContext(OpenProfileCtx);
}

export function useReigningChampion() {
  return useContext(ChampionCtx);
}

/**
 * Who is away in the week containing `weekRef`, with the flag to fly for them.
 *
 * Takes the week as an argument on purpose. The Week tab can page back through
 * finished weeks and the Board has five period tabs; a flag that came from
 * "now" would follow the athlete's name into all of them.
 */
export function useAwayIn(weekRef: DayKey) {
  const { activities, athletes } = useContext(AwayLogCtx);
  return useMemo(
    () => awayThisWeek(activities, weekRef, athletes),
    [activities, athletes, weekRef],
  );
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
  const log = useMemo(
    () => ({ activities: state.activities, athletes: state.athletes }),
    [state.activities, state.athletes],
  );
  return (
    <AwayLogCtx.Provider value={log}>
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
    </AwayLogCtx.Provider>
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
      className={`ml-1.5 inline-flex shrink-0 overflow-hidden rounded-[3px] align-middle shadow-sm ring-1 ring-black/10 ${
        // A leaf needs the extra couple of pixels to be a leaf rather than a dot.
        flag.emblem === "leaf" ? "h-[0.875rem] w-[1.375rem]" : "h-3 w-[1.125rem]"
      }`}
      title={`Away in ${flag.label}`}
      aria-label={`Away in ${flag.label}`}
      role="img"
    >
      {flag.emblem === "sun" ? (
        <span className="flex flex-1 items-center justify-center" style={{ backgroundColor: flag.mid }}>
          <span className="h-[0.4375rem] w-[0.4375rem] rounded-full" style={{ backgroundColor: flag.from }} />
        </span>
      ) : flag.emblem === "leaf" ? (
        // Canada's bands are 1:2:1, not thirds, and the leaf goes HERE at full
        // strength. In the lane behind the name it is a soft wash that the bar
        // cuts through; this is the one place on the row where nothing covers
        // it, so this is where it actually reads as a leaf.
        <>
          <span className="flex-1" style={{ backgroundColor: flag.from }} />
          <span className="flex-[2] flex items-center justify-center" style={{ backgroundColor: flag.mid }}>
            <svg viewBox={MAPLE_BOX} className="h-[0.625rem] w-[0.6875rem]" aria-hidden>
              <path fill={flag.from} d={MAPLE} />
            </svg>
          </span>
          <span className="flex-1" style={{ backgroundColor: flag.to }} />
        </>
      ) : (
        <>
          <span className="flex-1" style={{ backgroundColor: flag.from }} />
          <span className="flex-1" style={{ backgroundColor: flag.mid }} />
          <span className="flex-1" style={{ backgroundColor: flag.to }} />
        </>
      )}
    </span>
  );
}

/**
 * A person's name, tappable to open their profile. Renders as a role="button"
 * span (not a <button>) so it's valid even nested inside another clickable row —
 * the click is stopped from bubbling so it opens the profile, not the row.
 *
 * Deliberately never flies an away flag. This is the generic name, drawn in the
 * record book, the hall of fame, the titles page and last week's recap — none of
 * which is showing the away week, and a record set in March has nothing to do
 * with where its holder is in September. The two places that DO mean "this
 * week's standing" draw the flag themselves, from `useAwayIn`.
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
