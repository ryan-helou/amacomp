"use client";

import { useEffect, useState } from "react";
import { dayOfChristmas, isChristmasDay, isEpiphany } from "@/lib/festive";
import { useFestive } from "./Festive";

/**
 * The Christmas scenery and its easter eggs (lib/festive). The league are
 * friends from church, so this is Christmas the way they keep it: a star over
 * Bethlehem, a manger, crosses and trees — and a sleigh for fun.
 *
 * Everything here is decoration: aria-hidden, no layout of its own beyond the
 * footer, and gone for reduce-motion where it moves.
 */

const GOLD = "#f2c94c";
const RED = "#d42a35";

/** A plain gold cross. */
export function Cross({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 16" className={className} aria-hidden>
      <rect x="4.6" y="0.5" width="2.8" height="15" rx="0.6" fill={GOLD} />
      <rect x="0.8" y="4" width="10.4" height="2.8" rx="0.6" fill={GOLD} />
    </svg>
  );
}

/** The star over Bethlehem: four long points, four short, and a glow. */
export function StarShape({ className = "", glow = true }: { className?: string; glow?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden
      style={glow ? { filter: "drop-shadow(0 0 6px rgb(242 201 76 / 0.85))" } : undefined}
    >
      <path d="M20 0 L23 17 L40 20 L23 23 L20 40 L17 23 L0 20 L17 17 Z" fill={GOLD} />
      <path d="M20 9 L27 13 L31 20 L27 27 L20 31 L13 27 L9 20 L13 13 Z" fill="#fff3c4" opacity="0.55" />
      <circle cx="20" cy="20" r="3.2" fill="#fffbe8" />
    </svg>
  );
}

/**
 * The star on top of the week tree. Easter egg: tap it and it spins, flares
 * and wishes you a merry Christmas.
 */
export function RingStar({
  className = "top-[-18px]",
  size = "h-9 w-9",
  bubble = "top-[-58px]",
  lit = false,
}: {
  className?: string;
  size?: string;
  bubble?: string;
  lit?: boolean;
}) {
  const { on } = useFestive();
  const [sing, setSing] = useState(0);
  useEffect(() => {
    if (!sing) return;
    const t = setTimeout(() => setSing(0), 4200);
    return () => clearTimeout(t);
  }, [sing]);
  if (!on) return null;
  return (
    <>
      <button
        type="button"
        aria-label="The star"
        onClick={() => setSing((n) => n + 1)}
        className={`xmas-star absolute left-1/2 z-[2] -translate-x-1/2 ${size} ${className}`}
      >
        <StarShape className={`h-full w-full ${sing ? "xmas-star-sing" : lit ? "xmas-star-blaze" : ""}`} />
      </button>
      {sing > 0 && (
        <p
          key={sing}
          className={`xmas-gloria pointer-events-none absolute left-1/2 ${bubble} z-[3] w-max -translate-x-1/2 rounded-lg border border-gold/50 bg-deck/90 px-3 py-1 text-center text-[0.75rem] font-semibold text-ink`}
        >
          Merry Christmas!
        </p>
      )}
    </>
  );
}

/** A small pine with baubles and a star, for headings and the footer. */
export function ChristmasTree({ className = "", lit = true }: { className?: string; lit?: boolean }) {
  return (
    <svg viewBox="0 0 24 32" className={className} aria-hidden>
      <rect x="10.5" y="26" width="3" height="5" fill="#6b4423" />
      <path d="M12 3 L20 13 H16 L22 20 H17 L23 27 H1 L7 20 H2 L8 13 H4 Z" fill="#1f7a45" />
      <path d="M12 3 L20 13 H16 L22 20 H17 L23 27 H12 Z" fill="#185f36" />
      {lit && (
        <>
          <circle cx="9" cy="16" r="1.3" fill={RED} />
          <circle cx="15" cy="12.5" r="1.2" fill={GOLD} />
          <circle cx="14.5" cy="21" r="1.3" fill={RED} />
          <circle cx="8" cy="23.5" r="1.2" fill={GOLD} />
          <circle cx="18" cy="24.5" r="1.2" fill="#6fc3ff" />
          <circle cx="11" cy="9.5" r="1" fill="#6fc3ff" />
        </>
      )}
      <path d="M12 0 L13 2.4 L15.5 2.6 L13.6 4.2 L14.2 6.6 L12 5.3 L9.8 6.6 L10.4 4.2 L8.5 2.6 L11 2.4 Z" fill={GOLD} />
    </svg>
  );
}

/**
 * The scene at the foot of every tab: trees either side of a stable on a
 * snowy hill, the star over it and its long ray down to the manger. On Jan 6
 * the wise men arrive. Easter egg: tap the stable and the star flares.
 */
export function NativityFooter() {
  const { on, day } = useFestive();
  const [emmanuel, setEmmanuel] = useState(false);
  useEffect(() => {
    if (!emmanuel) return;
    const t = setTimeout(() => setEmmanuel(false), 4200);
    return () => clearTimeout(t);
  }, [emmanuel]);
  if (!on) return null;
  const nth = dayOfChristmas(day);
  const kings = isEpiphany(day);
  const ink = "var(--color-ink-3)";
  return (
    <div className="mt-10 flex flex-col items-center" aria-hidden={!emmanuel}>
      <button
        type="button"
        aria-label="The manger"
        onClick={() => setEmmanuel(true)}
        className="relative block w-full max-w-[22rem]"
      >
        <svg viewBox="0 0 320 120" className="w-full">
          {/* The star and its ray down to the stable. */}
          <path d="M160 10 L151 78 L169 78 Z" fill="url(#xmas-ray)" opacity="0.5" />
          <defs>
            <linearGradient id="xmas-ray" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={GOLD} stopOpacity="0.9" />
              <stop offset="1" stopColor={GOLD} stopOpacity="0" />
            </linearGradient>
          </defs>
          <g transform="translate(148 0)" className={emmanuel ? "xmas-star-flare" : "xmas-star-pulse"}>
            <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill={GOLD} />
          </g>
          {/* The hill, under snow. */}
          <defs>
            <linearGradient id="xmas-hill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--color-line-2)" />
              <stop offset="1" stopColor="var(--color-line-2)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 120 L0 104 Q80 86 160 92 Q240 86 320 104 L320 120 Z" fill="url(#xmas-hill)" />
          <path d="M0 104 Q80 86 160 92 Q240 86 320 104" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2" />
          {/* The stable. */}
          <path d="M122 92 L122 66 L160 44 L198 66 L198 92" fill="none" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M114 70 L160 40 L206 70" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {/* Joseph, with his staff. */}
          <circle cx="140" cy="66" r="4.2" fill={ink} />
          <path d="M134 92 L136 72 Q140 69 144 72 L146 92 Z" fill={ink} />
          <path d="M133 60 L133 92" stroke={ink} strokeWidth="1.6" />
          {/* Mary, kneeling. */}
          <circle cx="180" cy="72" r="4" fill={ink} />
          <path d="M172 92 Q173 77 180 76 Q187 77 188 92 Z" fill={ink} />
          {/* The manger, and the child in the light. */}
          <circle cx="160" cy="82" r="9" fill={GOLD} opacity="0.35" />
          <path d="M150 84 L170 84 L166 92 L154 92 Z" fill={ink} />
          <ellipse cx="160" cy="82.5" rx="6" ry="2.6" fill="#fff3c4" />
          {kings &&
            [234, 252, 270].map((x, i) => (
              <g key={x} fill={ink}>
                <circle cx={x} cy={78 - i} r="3.4" />
                <path d={`M${x - 5} 96 L${x - 3} ${82 - i} L${x + 3} ${82 - i} L${x + 5} 96 Z`} />
                <path d={`M${x - 3} ${74 - i} L${x - 2} ${71 - i} L${x} ${73 - i} L${x + 2} ${71 - i} L${x + 3} ${74 - i} Z`} fill={GOLD} />
              </g>
            ))}
        </svg>
        {/* Trees either side, drawn as the same pine as everywhere else. */}
        <ChristmasTree className="absolute bottom-[10%] left-[4%] h-14 w-10" />
        <ChristmasTree className="absolute bottom-[14%] left-[16%] h-9 w-7" />
        <ChristmasTree className="absolute bottom-[10%] right-[4%] h-14 w-10" />
        <ChristmasTree className="absolute bottom-[14%] right-[17%] h-10 w-7" />
      </button>
      <p className="mt-2 text-center text-[0.75rem] text-ink-3">
        {nth ? (
          <>The {ordinal(nth)} day of Christmas</>
        ) : kings ? (
          <>Epiphany — the wise men have come</>
        ) : (
          <>Merry Christmas from AmaComp</>
        )}
      </p>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** A small cross beside "I read the Bible today", while it's Christmas. */
export function BibleCross() {
  const { on } = useFestive();
  if (!on) return null;
  return <Cross className="-mt-0.5 ml-1.5 inline-block h-3.5 w-2.5 align-middle" />;
}

/** Christmas Day only: a banner at the top of the Week tab. */
export function ChristmasDayBanner() {
  const { on, day } = useFestive();
  if (!on || !isChristmasDay(day)) return null;
  return (
    <div className="mt-4 w-full overflow-hidden rounded-xl border border-gold/60 bg-gold/10 px-4 py-3 text-center">
      <div className="flex items-center justify-center gap-2">
        <StarShape className="h-5 w-5" />
        <span className="stamp text-lg leading-none text-ink">Merry Christmas</span>
        <StarShape className="h-5 w-5" />
      </div>
    </div>
  );
}

/**
 * The sky: a shooting star now and then, and Santa's sleigh whenever someone
 * finds the holly (three taps). Fixed over everything, never takes a tap.
 */
export function FestiveSky() {
  const { sleigh } = useFestive();
  return (
    <div aria-hidden className="snowfall pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <span className="xmas-shooting-star" />
      {sleigh > 0 && (
        <svg key={sleigh} viewBox="0 0 220 60" className="xmas-sleigh absolute h-14 w-56">
          {[0, 36, 72].map((x, i) => (
            <g key={x} fill="#8a5a2b" transform={`translate(${x} ${i % 2 ? 2 : 0})`}>
              <path d="M6 28 Q14 20 26 22 L30 18 L33 20 L30 25 Q28 32 20 32 L18 40 L15 40 L16 32 L10 32 L8 40 L5 40 L6 31 Z" />
              <path d="M28 18 L26 10 M28 18 L32 11 M26 13 L23 11 M31 14 L34 12" stroke="#8a5a2b" strokeWidth="1.4" fill="none" />
              {i === 0 && <circle cx="32" cy="21" r="1.8" fill={RED} />}
            </g>
          ))}
          <path d="M34 24 L118 30" stroke={GOLD} strokeWidth="0.8" />
          <path d="M118 22 L164 22 Q170 22 170 30 L166 40 L120 40 Q114 40 114 32 Z" fill={RED} />
          <path d="M110 44 L172 44 Q180 44 182 38" stroke={GOLD} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx="146" cy="14" r="6" fill="#f1c7a3" />
          <path d="M138 13 Q146 2 156 10 L150 13 Z" fill={RED} />
          <circle cx="157" cy="10" r="2" fill="#fff" />
          <path d="M140 18 Q146 30 152 18 Z" fill="#fff" />
          <path d="M138 22 L156 22 L158 30 L136 30 Z" fill={RED} />
          <rect x="158" y="16" width="10" height="8" fill="#2fbf6a" />
          <rect x="162" y="16" width="2" height="8" fill={GOLD} />
        </svg>
      )}
    </div>
  );
}

/**
 * A forest behind the whole app: two rows of pines along the bottom of the
 * screen — a far, faint one and a near one with snow on its branches and a few
 * lit — and two tall ones standing at the edges. Fixed, below every card
 * (the tiles are glass, so it shows through them softly), never takes a tap.
 */
function pine(x: number, base: number, h: number, fill: string, snow?: string) {
  const w = h * 0.62;
  const t = base - h;
  const tiers = [0.0, 0.3, 0.55];
  return (
    <g key={`${x}-${base}-${h}`}>
      <rect x={x - h * 0.04} y={base - h * 0.12} width={h * 0.08} height={h * 0.12} fill={fill} />
      {tiers.map((f, i) => {
        const top = t + h * f;
        const bw = (w / 2) * (0.6 + f * 0.75);
        const bot = top + h * 0.48;
        return (
          <g key={i}>
            <path d={`M${x} ${top} L${x + bw} ${bot} L${x - bw} ${bot} Z`} fill={fill} />
            {snow && <path d={`M${x} ${top} L${x + bw * 0.42} ${top + h * 0.2} Q${x} ${top + h * 0.15} ${x - bw * 0.42} ${top + h * 0.2} Z`} fill={snow} />}
          </g>
        );
      })}
    </g>
  );
}

export function BackgroundForest() {
  const far = [10, 46, 78, 118, 150, 196, 232, 268, 304, 344, 382];
  const near = [-6, 40, 96, 300, 352, 404];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden">
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="xmas-forest absolute inset-x-0 bottom-0 h-[42vh] w-full">
        <path d="M0 300 L0 236 Q100 214 200 226 Q300 212 400 232 L400 300 Z" fill="var(--forest-far)" opacity="0.7" />
        {far.map((x, i) => pine(x, 240 + (i % 3) * 4, 52 + ((i * 17) % 26), "var(--forest-far)"))}
        <path d="M0 300 L0 262 Q120 246 200 256 Q300 244 400 258 L400 300 Z" fill="var(--forest-near)" />
        {near.map((x, i) => pine(x, 268 + (i % 2) * 6, 92 + ((i * 23) % 30), "var(--forest-near)", "var(--forest-snow)"))}
        {/* A few lights on the near trees. */}
        {[[40, 236, RED], [52, 214, GOLD], [96, 226, "#6fc3ff"], [306, 232, GOLD], [296, 212, RED], [352, 222, RED], [362, 244, GOLD]].map(
          ([x, y, c], i) => (
            <circle key={i} cx={x as number} cy={y as number} r="2.2" fill={c as string} className="xmas-bulb" style={{ animationDelay: `${i * 0.37}s` }} />
          ),
        )}
      </svg>
      {/* Tall pines at the edges, halfway up, very faint. */}
      <svg viewBox="0 0 100 200" className="absolute -left-10 top-[28%] h-[34vh] w-[17vh] opacity-60">
        {pine(50, 200, 190, "var(--forest-far)")}
      </svg>
      <svg viewBox="0 0 100 200" className="absolute -right-12 top-[12%] h-[30vh] w-[15vh] opacity-50">
        {pine(50, 200, 190, "var(--forest-far)")}
      </svg>
    </div>
  );
}
