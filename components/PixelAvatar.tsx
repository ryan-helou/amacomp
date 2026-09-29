"use client";

import { useMemo } from "react";
import { avatarSvg, type Loadout } from "@/lib/pixelAvatar";

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
  className,
}: {
  loadout: Loadout;
  view?: "front" | "back";
  bust?: boolean;
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
  const svg = useMemo(
    () => avatarSvg(loadout, { view, crop: bust ? "bust" : "full" }),
    [loadout, view, bust],
  );

  if (flat) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a data: URI built here, not a file
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
        alt=""
        className={`pixel-avatar block ${className ?? ""}`}
      />
    );
  }

  return (
    <span
      className={`pixel-avatar block ${className ?? ""}`}
      // The sprite is built here, not fetched: no user input reaches it.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
