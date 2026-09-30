import { flagBanner } from "@/lib/flags";

/**
 * A country as a small hanging banner.
 *
 * The drawing comes from `flagBanner`, which is also what flies in the lane
 * behind a whole row — so the shop shows the thing you actually get, and the
 * two can never disagree about what a country looks like.
 */
export function CountryFlag({
  id,
  className = "h-3 w-[1.125rem]",
}: {
  id: string;
  className?: string;
}) {
  const svg = flagBanner(id);
  if (!svg) return null;
  return (
    <span
      className={`inline-block shrink-0 align-middle [&>svg]:h-full [&>svg]:w-full ${className}`}
      role="img"
      aria-label={id}
      // Generated from the catalogue in lib/flags.ts; no user input reaches it.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
