"use client";

import { useEffect, useRef, useState } from "react";
import { athleteColor } from "@/lib/avatar";
import { initials } from "@/lib/ui";
import type { Athlete } from "@/lib/types";

type AvatarAthlete = Pick<Athlete, "id" | "name"> &
  Partial<Pick<Athlete, "avatarColor" | "avatarUrl">>;

/** A profile avatar — the athlete's photo (uploaded or Strava) if they have one,
 *  otherwise their initials on a stable colour. `me` gets a ring so you can spot
 *  yourself. The colour still shows behind a transparent PNG and while a photo
 *  loads. */
export function Avatar({
  athlete,
  me = false,
  className = "h-9 w-9 text-[0.6875rem]",
}: {
  athlete: AvatarAthlete;
  me?: boolean;
  className?: string;
}) {
  const color = athlete.avatarColor ?? athleteColor(athlete);
  const url = athlete.avatarUrl ?? null;
  // A photo that failed (say, requested the moment a frozen app woke and the
  // connection wasn't back) shows initials rather than a broken-image "?", and
  // tries again the next time the app comes to the front. The browser never
  // retries a failed <img> by itself, so without this it stays broken.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!failed) return;
    function retry() {
      if (document.visibilityState !== "visible") return;
      setFailed(false);
      setAttempt((n) => n + 1);
    }
    document.addEventListener("visibilitychange", retry);
    const t = setTimeout(retry, 5000);
    return () => {
      document.removeEventListener("visibilitychange", retry);
      clearTimeout(t);
    };
  }, [failed]);
  const src = url && attempt > 0 ? `${url}${url.includes("?") ? "&" : "?"}retry=${attempt}` : url;
  // The photo is in the server-rendered HTML, so the browser can try it — and
  // fail — before React is listening; that error never reaches onError. Check
  // for an image that already finished broken the moment we take over.
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
     
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);
  return (
    <div
      aria-hidden
      style={{ backgroundColor: color }}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ${
        me ? "ring-2 ring-ink ring-offset-2 ring-offset-deck" : ""
      } ${className}`}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny same-origin/CDN avatar, next/image is overkill
        <img ref={img} src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initials(athlete.name)
      )}
    </div>
  );
}
