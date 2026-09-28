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
  className,
}: {
  loadout: Loadout;
  view?: "front" | "back";
  bust?: boolean;
  className?: string;
}) {
  const svg = useMemo(
    () => avatarSvg(loadout, { view, crop: bust ? "bust" : "full" }),
    [loadout, view, bust],
  );
  return (
    <span
      className={`pixel-avatar block ${className ?? ""}`}
      // The sprite is built here, not fetched: no user input reaches it.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
