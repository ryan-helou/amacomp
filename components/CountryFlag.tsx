import { MAPLE, MAPLE_BOX } from "@/lib/away";
import { FLAG_BY_ID } from "@/lib/flags";

/**
 * A flag as a small tag — the same look the Board already gives an away week,
 * drawn in SVG so it scales from the 18px chip beside a name up to the picture
 * on a shop box.
 *
 * The Board's own `FlagTag` stays as it is: it's three coloured spans for a
 * list of five countries, and rewriting it to serve a shop of two dozen would
 * be changing something that works for no one's benefit.
 */
export function CountryFlag({
  id,
  className = "h-3 w-[1.125rem]",
}: {
  id: string;
  className?: string;
}) {
  const flag = FLAG_BY_ID.get(id);
  if (!flag) return null;

  const W = 30;
  const H = 20;
  const weights = flag.weights ?? [1, 1, 1];
  const total = weights.reduce((a, b) => a + b, 0);

  // Bands, hoist to fly — or top to bottom when the flag is a horizontal one.
  const span = flag.rows ? H : W;
  const edges = weights.reduce<number[]>((acc, w) => [...acc, acc[acc.length - 1] + w], [0]);
  const bands = flag.bands.map((colour, i) => {
    const from = (edges[i] / total) * span;
    const to = (edges[i + 1] / total) * span;
    return flag.rows ? (
      <rect key={i} x={0} y={from} width={W} height={to - from} fill={colour} />
    ) : (
      <rect key={i} x={from} y={0} width={to - from} height={H} fill={colour} />
    );
  });

  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-[3px] align-middle ring-1 ring-black/20 ${className}`}
      role="img"
      aria-label={flag.label}
      title={flag.label}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        {bands}
        {flag.emblem && <Emblem kind={flag.emblem.kind} colour={flag.emblem.colour} w={W} h={H} />}
      </svg>
    </span>
  );
}

function Emblem({ kind, colour, w, h }: { kind: string; colour: string; w: number; h: number }) {
  const cx = w / 2;
  const cy = h / 2;
  switch (kind) {
    case "disc":
      return <circle cx={cx} cy={cy} r={h * 0.3} fill={colour} />;
    case "maple":
      // The real leaf, from the construction sheet the away tags use — eleven
      // points read as a maple leaf where a hand-drawn star reads as a blob.
      return (
        <svg x={cx - h * 0.28} y={cy - h * 0.3} width={h * 0.56} height={h * 0.6} viewBox={MAPLE_BOX}>
          <path fill={colour} d={MAPLE} />
        </svg>
      );
    case "cedar":
      // Three tiers on a short trunk. A cedar, not a Christmas tree: the tiers
      // are wide and flat.
      return (
        <g fill={colour}>
          <polygon points={`${cx},${cy - h * 0.34} ${cx + w * 0.11},${cy - h * 0.06} ${cx - w * 0.11},${cy - h * 0.06}`} />
          <polygon points={`${cx},${cy - h * 0.2} ${cx + w * 0.15},${cy + h * 0.12} ${cx - w * 0.15},${cy + h * 0.12}`} />
          <rect x={cx - w * 0.018} y={cy + h * 0.1} width={w * 0.036} height={h * 0.2} />
        </g>
      );
    case "cross":
      return (
        <g fill={colour}>
          <rect x={cx - w * 0.06} y={h * 0.1} width={w * 0.12} height={h * 0.8} />
          <rect x={w * 0.22} y={cy - h * 0.09} width={w * 0.56} height={h * 0.18} />
        </g>
      );
    case "chevron":
      return <polygon points={`0,0 ${w * 0.36},${cy} 0,${h}`} fill={colour} />;
    case "diamond":
      return (
        <polygon
          points={`${cx},${h * 0.12} ${w * 0.84},${cy} ${cx},${h * 0.88} ${w * 0.16},${cy}`}
          fill={colour}
        />
      );
    case "star": {
      const r = h * 0.3;
      const pts = Array.from({ length: 10 }, (_, i) => {
        const rad = i % 2 === 0 ? r : r * 0.42;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        return `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
      }).join(" ");
      return <polygon points={pts} fill={colour} />;
    }
    case "union": {
      // White saltire, red saltire over it, then the upright cross — the order
      // matters, and a plain red cross on blue is a different flag entirely.
      const d = `M0,0 L${w},${h} M${w},0 L0,${h}`;
      return (
        <g>
          <path d={d} stroke="#FFFFFF" strokeWidth={h * 0.3} fill="none" />
          <path d={d} stroke={colour} strokeWidth={h * 0.14} fill="none" />
          <path d={`M${cx},0 V${h} M0,${cy} H${w}`} stroke="#FFFFFF" strokeWidth={h * 0.34} fill="none" />
          <path d={`M${cx},0 V${h} M0,${cy} H${w}`} stroke={colour} strokeWidth={h * 0.2} fill="none" />
        </g>
      );
    }
    case "unionCanton": {
      // The union at quarter size in the canton, and the big star under it.
      const uw = w * 0.42;
      const uh = h * 0.5;
      const d = `M0,0 L${uw},${uh} M${uw},0 L0,${uh}`;
      return (
        <g>
          <path d={d} stroke={colour} strokeWidth={uh * 0.26} fill="none" />
          <path d={`M${uw / 2},0 V${uh} M0,${uh / 2} H${uw}`} stroke={colour} strokeWidth={uh * 0.3} fill="none" />
          <polygon
            points={Array.from({ length: 14 }, (_, i) => {
              const r = i % 2 === 0 ? h * 0.2 : h * 0.09;
              const a = -Math.PI / 2 + (i * Math.PI) / 7;
              return `${uw / 2 + r * Math.cos(a)},${uh + h * 0.22 + r * Math.sin(a)}`;
            }).join(" ")}
            fill={colour}
          />
          <circle cx={w * 0.78} cy={h * 0.3} r={h * 0.09} fill={colour} />
          <circle cx={w * 0.7} cy={h * 0.62} r={h * 0.07} fill={colour} />
          <circle cx={w * 0.88} cy={h * 0.66} r={h * 0.07} fill={colour} />
        </g>
      );
    }
    case "saltire":
      // Jamaica: the gold cross corner to corner, green above and below.
      return (
        <g>
          <polygon points={`${cx},${cy} ${w * 0.16},0 ${w * 0.84},0`} fill="#009B3A" />
          <polygon points={`${cx},${cy} ${w * 0.16},${h} ${w * 0.84},${h}`} fill="#009B3A" />
          <path d={`M0,0 L${w},${h} M${w},0 L0,${h}`} stroke={colour} strokeWidth={h * 0.22} fill="none" />
        </g>
      );
    default:
      return null;
  }
}
