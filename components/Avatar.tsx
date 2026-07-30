import { athleteColor } from "@/lib/avatar";
import { initials } from "@/lib/ui";
import type { Athlete } from "@/lib/types";

/** A colour-coded initials avatar. `me` gets a ring so you can spot yourself. */
export function Avatar({
  athlete,
  me = false,
  className = "h-9 w-9 text-[0.6875rem]",
}: {
  athlete: Pick<Athlete, "id" | "name">;
  me?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      style={{ backgroundColor: athleteColor(athlete) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${
        me ? "ring-2 ring-ink ring-offset-2 ring-offset-deck" : ""
      } ${className}`}
    >
      {initials(athlete.name)}
    </div>
  );
}
