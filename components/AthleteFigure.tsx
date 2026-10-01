"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { athleteColor } from "@/lib/avatar";
import { AVATAR_ITEM_BY_ID, lookFor, type Loadout } from "@/lib/pixelAvatar";
import { flagLane } from "@/lib/flags";
import { PixelAvatar } from "./PixelAvatar";

type Who = { id: string; name: string; avatarColor?: string | null };
type Saved = Record<string, Record<string, { item: string }>> | undefined;

/**
 * Everyone's saved avatar, put where any row can reach it.
 *
 * A figure turns up in a rank row, a week row, a title row and a sheet, all
 * of them several components deep. Threading one map down four prop chains
 * would mean four places to forget it, and a forgotten one doesn't crash — it
 * quietly draws the generated look instead of the one the athlete chose,
 * which is the kind of bug nobody reports and everybody sees.
 */
const Saved = createContext<Saved>(undefined);

/**
 * Whether this viewer gets pixel figures at all.
 *
 * Ryan's call: the characters go live on the real app but only on his own
 * account, the same door the Club uses. Everyone else keeps the initials
 * avatar they have always had and never sees a half-finished league of
 * cartoon men. Gated here rather than at each row so there is one switch,
 * and so a row that forgets to ask falls back to the safe answer.
 */
const Showing = createContext(false);

export function LoadoutsProvider({
  loadouts,
  showFigures,
  children,
}: {
  loadouts: Saved;
  showFigures: boolean;
  children: ReactNode;
}) {
  return (
    <Showing.Provider value={showFigures}>
      <Saved.Provider value={loadouts}>{children}</Saved.Provider>
    </Showing.Provider>
  );
}

/** True when this viewer should be shown figures instead of initials. */
export function useFigures(): boolean {
  return useContext(Showing);
}

/**
 * One place decides what an athlete looks like.
 *
 * Every screen that draws a figure comes through here, so a saved avatar and
 * a generated one are never two code paths — the Board can't end up drawing
 * five characters and a blank for the sixth. A prize can be forced on from
 * outside (`prize`), because a champion wears the crown whether or not they
 * happened to save it in the shop.
 */
function look(who: Who, saved: Saved, prize?: string): Loadout {
  const base = lookFor(who, saved);
  return prize ? { ...base, prize: { item: prize } } : base;
}

/**
 * The head-and-shoulders crop, in a disc — a drop-in for the initials avatar.
 *
 * The athlete's colour stays as the disc behind him. It's the thing your eye
 * has learnt to find a person by on a crowded row, and it still shows through
 * around the shoulders, so the row reads the same at a glance and better up
 * close.
 *
 * `flat` is not optional at this size: the figure is a couple of thousand
 * rectangles, and six live copies of that on the Board's first paint is a
 * five-figure DOM. As an image it's one node each.
 */
export function Face({
  athlete,
  loadouts,
  me = false,
  prize,
  className = "h-9 w-9",
}: {
  athlete: Who;
  loadouts?: Saved;
  me?: boolean;
  prize?: string;
  className?: string;
}) {
  const fromContext = useContext(Saved);
  const saved = loadouts ?? fromContext;
  const worn = useMemo(() => look(athlete, saved, prize), [athlete, saved, prize]);
  return (
    <span
      aria-hidden
      style={{ backgroundColor: athlete.avatarColor ?? athleteColor(athlete) }}
      className={`relative flex shrink-0 items-end justify-center overflow-hidden rounded-full ${
        me ? "ring-2 ring-ink ring-offset-2 ring-offset-deck" : ""
      } ${className}`}
    >
      <PixelAvatar loadout={worn} bust flat className="h-full w-full" />
    </span>
  );
}

/**
 * The whole figure, head to shoes, optionally standing on his own flag.
 *
 * This is the only place the shoes and the bottom half of a tri
 * suit are visible at all — everywhere else crops at the shoulders. If a
 * screen is meant to show off what someone is wearing, it wants this.
 */
export function Figure({
  athlete,
  loadouts,
  prize,
  flag,
  className = "w-28",
}: {
  athlete: Who;
  loadouts?: Saved;
  prize?: string;
  /**
   * A country id from lib/flags, drawn as the ground he stands on. Left out,
   * it comes from the flag he bought — which is the point of buying one.
   */
  flag?: string | null;
  /**
   * Sets the figure's WIDTH. globals.css gives every avatar svg
   * `width: 100%; height: auto`, which a height utility can't outrank, so
   * the height comes from the 82x128 viewBox — about 1.56x whatever width
   * you set here.
   */
  className?: string;
}) {
  const fromContext = useContext(Saved);
  const saved = loadouts ?? fromContext;
  const worn = useMemo(() => look(athlete, saved, prize), [athlete, saved, prize]);
  const flown = flag === undefined
    ? AVATAR_ITEM_BY_ID.get(worn.flag?.item ?? "")?.flag ?? null
    : flag;
  const lane = flown ? flagLane(flown) : null;
  return (
    <span
      className="relative flex items-end justify-center overflow-hidden rounded-xl"
      style={lane ? (lane as React.CSSProperties) : undefined}
    >
      <PixelAvatar loadout={worn} className={`relative ${className}`} />
    </span>
  );
}

/**
 * Front and back, side by side.
 *
 * Half of what someone buys only exists from behind — the aero helmet has its
 * own tail, long hair has a back, a sash crosses the other shoulder — and
 * until now nothing in the app ever turned the figure round. Both at once
 * rather than a flip: a toggle hides half the answer behind a tap nobody
 * knows to make, and there is room for two at this size.
 */
export function TurnAround({
  athlete,
  loadouts,
  prize,
  flag,
  className = "w-24",
}: {
  athlete: Who;
  loadouts?: Saved;
  prize?: string;
  flag?: string | null;
  className?: string;
}) {
  const fromContext = useContext(Saved);
  const saved = loadouts ?? fromContext;
  const worn = useMemo(() => look(athlete, saved, prize), [athlete, saved, prize]);
  const flown = flag === undefined
    ? AVATAR_ITEM_BY_ID.get(worn.flag?.item ?? "")?.flag ?? null
    : flag;
  const lane = flown ? flagLane(flown) : null;
  return (
    <span
      className="relative flex items-end justify-center gap-6 overflow-hidden rounded-2xl py-3"
      style={lane ? (lane as React.CSSProperties) : undefined}
    >
      {/* No captions. Which one is the back is obvious from the drawing, and
          two words of chrome under a pair of figures is the label telling you
          the picture is a picture. */}
      {(["front", "back"] as const).map((view) => (
        <PixelAvatar key={view} loadout={worn} view={view} className={`relative ${className}`} />
      ))}
    </span>
  );
}

/**
 * The lane a row flies: the athlete's bought flag, as CSS the row can spread.
 *
 * Returned rather than rendered, because the row is a <button> and the lane
 * has to be its background — a child span would sit above the content or
 * below the ring depending on the day, and the ink variables have to land on
 * the element the text inherits from.
 */
export function laneFor(
  athlete: Who,
  saved: Saved,
): React.CSSProperties | undefined {
  const flag = AVATAR_ITEM_BY_ID.get(lookFor(athlete, saved).flag?.item ?? "")?.flag;
  return (flag ? flagLane(flag) : null) as React.CSSProperties | undefined;
}

/** The hook form, for rows that read the lane out of context. */
export function useLane(athlete: Who): React.CSSProperties | undefined {
  const saved = useContext(Saved);
  const showing = useContext(Showing);
  return useMemo(() => (showing ? laneFor(athlete, saved) : undefined), [athlete, saved, showing]);
}
