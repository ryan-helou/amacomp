import { athleteColor } from "@/lib/avatar";
import { initials } from "@/lib/ui";
import { isAvatarGlyph, type Athlete } from "@/lib/types";
import { Glyph, type GlyphName } from "./Glyph";

type AvatarAthlete = Pick<Athlete, "id" | "name"> & Partial<Pick<Athlete, "avatarColor" | "avatarGlyph">>;

/** A colour-coded avatar — chosen colour + glyph if the athlete set one,
 *  otherwise a hashed colour + initials. `me` gets a ring so you can spot yourself. */
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
  const glyph = isAvatarGlyph(athlete.avatarGlyph) ? (athlete.avatarGlyph as GlyphName) : null;
  return (
    <div
      aria-hidden
      style={{ backgroundColor: color }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${
        me ? "ring-2 ring-ink ring-offset-2 ring-offset-deck" : ""
      } ${className}`}
    >
      {glyph ? <Glyph name={glyph} className="h-[55%] w-[55%]" /> : initials(athlete.name)}
    </div>
  );
}
