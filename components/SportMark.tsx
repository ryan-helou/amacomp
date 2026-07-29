import type { Sport } from "@/lib/types";

/** Geometric marks, not illustrations: water, a wheel, a stride. */
export function SportMark({
  sport,
  className = "h-4 w-4",
}: {
  sport: Sport;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (sport === "swim") {
    return (
      <svg {...common}>
        <path d="M2 8c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" />
        <path d="M2 14c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" />
        <path d="M2 20c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" />
      </svg>
    );
  }

  if (sport === "bike") {
    return (
      <svg {...common}>
        <circle cx="5.5" cy="17" r="3.5" />
        <circle cx="18.5" cy="17" r="3.5" />
        <path d="M5.5 17 10 7h5l3.5 10" />
        <path d="M9 7h4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="15" cy="4.5" r="2" />
      <path d="M13.5 21l1.5-6-3.5-3 1-5 3 3 3 1" />
      <path d="M11.5 12 8 14l-2 5" />
    </svg>
  );
}
