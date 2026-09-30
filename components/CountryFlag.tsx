import { flagSvg } from "@/lib/flags";

/**
 * A flag as a small tag.
 *
 * The same drawing that washes a whole row in the lane, so the shop and the
 * board can never disagree about what a country looks like.
 */
export function CountryFlag({
  id,
  className = "h-3 w-[1.125rem]",
}: {
  id: string;
  className?: string;
}) {
  const svg = flagSvg(id);
  if (!svg) return null;
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-[3px] align-middle ring-1 ring-black/20 [&>svg]:h-full [&>svg]:w-full ${className}`}
      role="img"
      aria-label={id}
      // Generated from the catalogue in lib/flags.ts; no user input reaches it.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
