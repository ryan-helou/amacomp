import type { Sport } from "@/lib/types";

/**
 * The discipline marks: water, a wheel, a stride, a bar.
 *
 * All one weight, all drawn on the same 24-unit grid, and all filling the box
 * top to bottom — a mark that sits in the middle band reads as smaller than its
 * neighbours even at the same size.
 */
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

  if (sport === "run") {
    // Five separate strokes — head, torso, front leg, trailing leg, driving arm
    // — rather than one polyline folded through the whole body. The polyline
    // version had to double back on itself to get from the foot to the arm,
    // which left the torso a single unit long and pushed the head into the
    // shoulder: at 14px it read as a crouch rather than a stride.
    return (
      <svg {...common}>
        <circle cx="15.2" cy="4.3" r="2.1" />
        <path d="M13.6 8.4 10.8 13.4" />
        <path d="M10.8 13.4 14.4 15.8 14.8 20.8" />
        <path d="M10.8 13.4 6.6 15 4.6 19.6" />
        <path d="M13.9 9.6 18.2 10.8" />
      </svg>
    );
  }

  // Gym — a dumbbell
  return (
    <svg {...common}>
      <path d="M6.5 12h11" />
      <path d="M4 9v6M7 7.5v9M17 7.5v9M20 9v6" />
    </svg>
  );
}
