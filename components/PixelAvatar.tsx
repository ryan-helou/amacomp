"use client";

import { useMemo } from "react";
import { avatarSvg, type Loadout } from "@/lib/pixelAvatar";
import { SANTA_HAT } from "@/lib/festive";
import { useFestive } from "./Festive";

/**
 * The pixel figure, drawn from a loadout.
 *
 * `bust` is the head-and-shoulders crop that sits where the round avatar does
 * on the Board — the same drawing, a tighter window, never a second sprite.
 */
export function PixelAvatar({
  loadout,
  view = "front",
  bust = false,
  flat = false,
  gilded = false,
  className,
}: {
  loadout: Loadout;
  view?: "front" | "back";
  bust?: boolean;
  /** The reigning champion: the same figure with a gold edge and a gold glow. */
  gilded?: boolean;
  /**
   * Draw it as an image rather than as live SVG.
   *
   * The figure is a couple of thousand rectangles. That's worth it at full
   * size, where they breathe; at 36px it is thousands of DOM nodes for a
   * circle you could cover with a thumbnail, and every change re-parses the
   * lot. An image costs one node and the browser rasterises it.
   */
  flat?: boolean;
  className?: string;
}) {
  // At Christmas every figure wears the Santa hat (lib/festive) — over
  // whatever he bought for his head, which comes back on Jan 7.
  const { on: festive } = useFestive();
  const dressed = useMemo(
    () => (festive ? { ...loadout, head: { item: SANTA_HAT } } : loadout),
    [festive, loadout],
  );
  const svg = useMemo(
    () => avatarSvg(dressed, { view, crop: bust ? "bust" : "full", gilded }),
    [dressed, view, bust, gilded],
  );

  // The champion's glow. Ryan, 2026-10-07: "just add a gold glow around me."
  // Two drop-shadows: a tight one that hugs the outline and a wide soft one,
  // so it reads as light round him rather than a second outline.
  const glow = gilded
    ? { filter: "drop-shadow(0 0 1.5px rgba(240,198,75,0.95)) drop-shadow(0 0 7px rgba(226,181,61,0.6))" }
    : undefined;

  if (flat) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a data: URI built here, not a file
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
        alt=""
        className={`pixel-avatar block ${className ?? ""}`}
        style={glow}
      />
    );
  }

  return (
    <span
      className={`pixel-avatar block ${className ?? ""}`}
      style={glow}
      // The sprite is built here, not fetched: no user input reaches it.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
