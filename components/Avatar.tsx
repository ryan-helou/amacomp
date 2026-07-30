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
  return (
    <div
      aria-hidden
      style={{ backgroundColor: color }}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ${
        me ? "ring-2 ring-ink ring-offset-2 ring-offset-deck" : ""
      } ${className}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny same-origin/CDN avatar, next/image is overkill
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(athlete.name)
      )}
    </div>
  );
}
