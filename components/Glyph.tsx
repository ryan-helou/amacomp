/**
 * Minimal line glyphs in the same geometric style as SportMark — used in place
 * of emoji for trophies, badges and the like.
 */
export type GlyphName =
  | "trophy"
  | "drop"
  | "target"
  | "flame"
  | "trio"
  | "medal"
  | "star"
  | "rings"
  | "dumbbell"
  | "bolt"
  | "chat"
  | "trash";

export function Glyph({
  name,
  className = "h-4 w-4",
}: {
  name: GlyphName;
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

  switch (name) {
    case "trophy":
      return (
        <svg {...common}>
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
          <path d="M7 5H4v1a3 3 0 0 0 3 3" />
          <path d="M17 5h3v1a3 3 0 0 1-3 3" />
          <path d="M12 14v3" />
          <path d="M8.5 21h7" />
          <path d="M9.5 21a2.5 2.5 0 0 1 5 0" />
        </svg>
      );
    case "drop":
      return (
        <svg {...common}>
          <path d="M12 3s6 6.3 6 10.5A6 6 0 0 1 6 13.5C6 9.3 12 3 12 3Z" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path d="M12 3c.8 3 3.8 4.2 3.8 8A3.8 3.8 0 0 1 8.2 11c0-1 .4-1.8 1-2.4C10.5 10 12 8.4 12 3Z" />
        </svg>
      );
    case "trio":
      return (
        <svg {...common}>
          <path d="M6 16V9" />
          <path d="M12 16V6" />
          <path d="M18 16v-4" />
        </svg>
      );
    case "medal":
      return (
        <svg {...common}>
          <path d="M8 3l4 6 4-6" />
          <circle cx="12" cy="15" r="6" />
          <path d="M12 12.5l1 2 2 .2-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L10 14.7l2-.2Z" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="M12 3.5l2.5 5.5 6 .6-4.5 4 1.3 5.9L12 21.5 6.7 19.5 8 13.6 3.5 9.6l6-.6Z" />
        </svg>
      );
    case "rings":
      return (
        <svg {...common}>
          <circle cx="8.5" cy="12" r="5" />
          <circle cx="15.5" cy="12" r="5" />
        </svg>
      );
    case "dumbbell":
      return (
        <svg {...common}>
          <path d="M6.5 12h11" />
          <path d="M4 9v6M7 7.5v9M17 7.5v9M20 9v6" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-7.5Z" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4 6.5h16" />
          <path d="M9 6.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5" />
          <path d="M6.5 6.5 7.5 20a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9l1-13.5" />
          <path d="M10 10v7M14 10v7" />
        </svg>
      );
  }
}
