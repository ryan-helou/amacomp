"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { fmtPoints, type Standing } from "@/lib/scoring";
import type { SeasonMoment as Moment } from "@/lib/seasonMoment";
import { Avatar } from "./Avatar";
import { Glyph } from "./Glyph";

/**
 * The season's closing announcement — a sibling of the kickoff card.
 *
 * Same pool-ink ground and stamp type, so it reads as the league speaking: a
 * podium, and the two tickets the house rules promise — who eats free and who
 * hosts the potluck. Still no confetti; that means someone hit quota.
 *
 * There was a run-in here too — a countdown for the last days of a season and
 * a "THE TABLE LOCKS" card on the last one. Ryan removed it on 2026-10-06.
 */

const GOLD = "#e2b53d";

const GOLD_FILL = "linear-gradient(168deg, #ffeaa4 0%, #e2b53d 46%, #b98d09 100%)";
const INK = "#081722";

// Beat sheet, in seconds.
const T_TOP = 0.15;
const T_HERO = 0.3;
const T_BODY = 1.0;

const goldText: CSSProperties = {
  backgroundImage: GOLD_FILL,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const rise = (delay: number, ms = 620): CSSProperties => ({
  animation: `sk-rise ${ms}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}s both`,
});

// ── Shared pieces ────────────────────────────────────────────────────────────

/** Deterministic scatter, so a particle field is identical on every render. */
function scatter(count: number, seed: number) {
  return Array.from({ length: count }, (_, i) => {
    const r = (k: number) => {
      const x = Math.sin((i + 1) * 12.9898 * (k + 1) + seed * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return { x: r(0), y: r(1), size: r(2), delay: r(3), speed: r(4), drift: r(5) - 0.5 };
  });
}

function Stage({
  label,
  glow,
  horizon,
  floodlights,
  spotlight,
  children,
}: {
  label: string;
  glow: string;
  /** Night falling: stars, a rising moon, a warm horizon throwing up embers. */
  horizon?: boolean;
  /** Stadium lights leaning in from the top corners. */
  floodlights?: boolean;
  /** A cone of light onto the podium, with gold dust drifting up through it. */
  spotlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[60] overflow-hidden text-white"
      style={{ backgroundColor: INK, animation: "sk-veil 420ms ease-out both" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(115% 55% at 50% -10%, ${glow} 0%, transparent 55%)`,
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-[-25%]"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(61,140,220,0.26), transparent 70%)," +
              "radial-gradient(closest-side, rgba(90,200,230,0.18), transparent 70%)",
            backgroundSize: "58% 42%, 44% 34%",
            backgroundPosition: "12% 22%, 74% 58%",
            backgroundRepeat: "no-repeat",
            filter: "blur(38px)",
            animation: "sk-caustic-a 19s ease-in-out infinite",
          }}
        />
      </div>
      {floodlights && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ animation: "sk-veil 1400ms ease-out both" }}>
          {(["l", "r"] as const).map((side) => (
            <div
              key={side}
              className="absolute -top-24 h-[130%] w-40"
              style={{
                [side === "l" ? "left" : "right"]: "-3rem",
                transformOrigin: "50% 0%",
                background:
                  "linear-gradient(180deg, rgba(255,246,214,0.42) 0%, rgba(255,236,180,0.12) 38%, transparent 70%)",
                clipPath: "polygon(38% 0, 62% 0, 100% 100%, 0 100%)",
                filter: "blur(10px)",
                mixBlendMode: "screen",
                animation: `sm-beam-${side} ${side === "l" ? 9 : 11}s ease-in-out infinite`,
              }}
            />
          ))}
          {(["l", "r"] as const).map((side) => (
            <div
              key={`lamp-${side}`}
              className="absolute -top-3 h-8 w-16 rounded-full"
              style={{
                [side === "l" ? "left" : "right"]: "0.75rem",
                background: "radial-gradient(closest-side, rgba(255,250,230,0.95), rgba(255,236,180,0.35) 55%, transparent)",
                filter: "blur(2px)",
              }}
            />
          ))}
        </div>
      )}
      {spotlight && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 top-0 h-[70%] w-[26rem] -translate-x-1/2"
            style={{
              background: "linear-gradient(180deg, rgba(255,240,200,0.30) 0%, rgba(255,220,140,0.10) 55%, transparent 100%)",
              clipPath: "polygon(44% 0, 56% 0, 100% 100%, 0 100%)",
              filter: "blur(14px)",
              mixBlendMode: "screen",
              animation: "sk-veil 1800ms ease-out 0.4s both",
            }}
          />
          {scatter(16, 7).map((d, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${18 + d.x * 64}%`,
                top: `${52 + d.y * 40}%`,
                width: `${2 + d.size * 3}px`,
                height: `${2 + d.size * 3}px`,
                background: "radial-gradient(circle, #fff3c4, #e2b53d 60%, transparent)",
                boxShadow: "0 0 6px rgba(226,181,61,0.9)",
                ["--dx" as string]: `${d.drift * 60}px`,
                ["--dy" as string]: `-${38 + d.speed * 30}vh`,
                animation: `sm-drift ${7 + d.speed * 6}s ease-in ${1.6 + d.delay * 6}s infinite`,
              }}
            />
          ))}
        </div>
      )}
      {horizon && (
        <>
          {/* Stars, twinkling out of step with each other. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2">
            {scatter(22, 3).map((st, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  left: `${st.x * 100}%`,
                  top: `${st.y * 100}%`,
                  width: `${1 + st.size * 1.6}px`,
                  height: `${1 + st.size * 1.6}px`,
                  animation: `sk-veil 2400ms ease-out both, sm-twinkle ${2.5 + st.speed * 3}s ease-in-out ${st.delay * 3}s infinite`,
                }}
              />
            ))}
          </div>
          {/* The moon, coming up in the corner. */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-7 top-16 h-14 w-14 rounded-full"
            style={{
              background: "radial-gradient(circle at 35% 35%, #fffdf2 0%, #f1e6c4 55%, #d9c89a 100%)",
              boxShadow: "0 0 40px 12px rgba(255,244,210,0.22), inset -8px -6px 0 0 rgba(0,0,0,0.12)",
              animation: "sm-moonrise 3200ms cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
          />
          {/* Embers lifting off the horizon. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2">
            {scatter(14, 11).map((e, i) => (
              <span
                key={i}
                className="absolute bottom-0 rounded-full"
                style={{
                  left: `${e.x * 100}%`,
                  width: `${2 + e.size * 3}px`,
                  height: `${2 + e.size * 3}px`,
                  background: "radial-gradient(circle, #ffd8a8, #ff7a3d 60%, transparent)",
                  boxShadow: "0 0 8px rgba(255,120,60,0.8)",
                  ["--dx" as string]: `${e.drift * 80}px`,
                  ["--dy" as string]: `-${22 + e.speed * 26}vh`,
                  animation: `sm-drift ${5 + e.speed * 5}s ease-out ${e.delay * 5}s infinite`,
                }}
              />
            ))}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]"
            style={{
              background:
                "radial-gradient(90% 70% at 50% 118%, rgba(255,120,60,0.55) 0%, rgba(190,50,70,0.28) 38%, transparent 70%)",
              animation: "sk-veil 1800ms ease-out both",
            }}
          />
        </>
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 75% at 50% 42%, transparent 40%, rgba(3,10,16,0.7) 100%)",
        }}
      />
      <div className="relative flex h-full flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.75rem,env(safe-area-inset-top))]">
        {children}
      </div>
    </div>
  );
}

function Eyebrow({ children, delay }: { children: ReactNode; delay: number }) {
  return (
    <p
      className="flex items-center justify-center gap-2 font-mono text-[0.6875rem] tracking-[0.22em] text-white/55"
      style={{ animation: `sk-eyebrow 700ms ease-out ${delay}s both` }}
    >
      {children}
    </p>
  );
}

function ordinal(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

function Outro({
  delay,
  children,
  button,
  onDismiss,
}: {
  delay: number;
  children?: ReactNode;
  button: string;
  onDismiss: () => void;
}) {
  return (
    <div className="shrink-0 pt-4" style={{ animation: `sk-rise 640ms ease-out ${delay}s both` }}>
      {children && (
        <p className="text-balance text-center text-sm leading-relaxed text-white/60">{children}</p>
      )}
      <button onClick={onDismiss} autoFocus className="accent-fill eyebrow mt-3 w-full rounded-xl px-4 py-4 shadow-lg">
        {button}
      </button>
    </div>
  );
}

// ── Final stretch ────────────────────────────────────────────────────────────

// ── Last day ─────────────────────────────────────────────────────────────────

// ── Champion ─────────────────────────────────────────────────────────────────

/** Gold, silver, bronze — each a lit top, a brushed front, and a floor reflection. */
const METAL = {
  1: {
    lid: "linear-gradient(90deg, #b8870f 0%, #ffe9a3 30%, #fff6d6 50%, #ffe9a3 70%, #b8870f 100%)",
    face: "linear-gradient(180deg, #e4b43c 0%, #b98a14 45%, #7a5605 100%)",
    ink: "rgba(60,40,0,0.55)",
    glow: "rgba(226,181,61,0.55)",
  },
  2: {
    lid: "linear-gradient(90deg, #7d868f 0%, #eef2f5 30%, #ffffff 50%, #eef2f5 70%, #7d868f 100%)",
    face: "linear-gradient(180deg, #cdd4da 0%, #939ca5 45%, #555d66 100%)",
    ink: "rgba(20,28,36,0.5)",
    glow: "rgba(210,220,230,0.35)",
  },
  3: {
    lid: "linear-gradient(90deg, #7f4a26 0%, #f3c49a 30%, #ffe2c7 50%, #f3c49a 70%, #7f4a26 100%)",
    face: "linear-gradient(180deg, #d3915c 0%, #a0633a 45%, #5e361b 100%)",
    ink: "rgba(45,20,5,0.55)",
    glow: "rgba(210,140,90,0.35)",
  },
} as const;

/**
 * A laurel wreath, generated rather than drawn: a stem arcing up each side from
 * the bottom, open at the top, with pairs of leaves that point along the stem
 * toward its tip and shrink as they go. Built from geometry because hand-drawn
 * leaves were the maple leaf's lesson — and an earlier cut that scattered leaves
 * evenly round the circle read as a sunburst, not a wreath. It is the stem and
 * the direction of the leaves that make it a laurel.
 *
 * Drawn in a 100-unit box where the avatar is radius 30, so the SVG is sized at
 * 100/60 of the avatar's diameter.
 */
function Laurel({ delay }: { delay: number }) {
  const cx = 50;
  const cy = 50;
  const r = 40;
  const FROM = 18; // degrees either side of straight down where the stems start
  const TO = 135; // how far round they climb
  const COUNT = 9;
  const SPLAY = 38;
  const RX = 5.2;
  const RY = 2.0;
  const GAP = 0.8;
  const TAPER = 0.45;
  const rad = (d: number) => (d * Math.PI) / 180;
  const pt = (deg: number, rr: number): [number, number] => [cx + rr * Math.cos(rad(deg)), cy + rr * Math.sin(rad(deg))];
  const f = (n: number) => n.toFixed(2);

  const stems: string[] = [];
  const leaves: { x: number; y: number; rx: number; ry: number; rot: number }[] = [];
  for (const side of [-1, 1]) {
    const a0 = 90 - side * FROM;
    const a1 = 90 - side * TO;
    const [x0, y0] = pt(a0, r);
    const [x1, y1] = pt(a1, r);
    stems.push(`M${f(x0)} ${f(y0)} A${r} ${r} 0 0 ${side < 0 ? 1 : 0} ${f(x1)} ${f(y1)}`);
    const leaf = (deg: number, rr: number, rot: number, scale: number) => {
      const [x, y] = pt(deg, rr);
      // The leaf's base sits on the stem and it reaches forward.
      const reach = RX * scale * 0.8;
      leaves.push({
        x: x + Math.cos(rad(rot)) * reach,
        y: y + Math.sin(rad(rot)) * reach,
        rx: RX * scale,
        ry: RY * scale,
        rot,
      });
    };
    for (let i = 0; i < COUNT; i++) {
      const t = i / (COUNT - 1);
      const deg = a0 + (a1 - a0) * t;
      const heading = deg + (side < 0 ? 90 : -90); // direction of growth
      const scale = 1 - t * TAPER;
      for (const k of [-1, 1]) leaf(deg, r + k * GAP, heading + k * side * SPLAY, scale);
    }
    leaf(a1, r, a1 + (side < 0 ? 90 : -90), 0.62); // the leaf at the tip
  }

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className="pointer-events-none absolute left-1/2 top-1/2 h-[168%] w-[168%] -translate-x-1/2 -translate-y-1/2 overflow-visible"
      style={{ animation: `sk-rise 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}s both` }}
    >
      <defs>
        <linearGradient id="laurel-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.5" stopColor="#e2b53d" />
          <stop offset="1" stopColor="#a87b0a" />
        </linearGradient>
      </defs>
      {stems.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="url(#laurel-gold)" strokeWidth="1.1" strokeLinecap="round" />
      ))}
      {leaves.map((l, i) => (
        <ellipse
          key={i}
          cx={f(l.x)}
          cy={f(l.y)}
          rx={f(l.rx)}
          ry={f(l.ry)}
          fill="url(#laurel-gold)"
          transform={`rotate(${l.rot.toFixed(1)} ${f(l.x)} ${f(l.y)})`}
        />
      ))}
    </svg>
  );
}

function Podium({ table, meId }: { table: Standing[]; meId?: string }) {
  const scored = table.filter((s) => s.points > 0);
  const [first, second, third] = scored;
  if (!first) return null;
  const columns: { s: Standing | undefined; place: 1 | 2 | 3 }[] = [
    { s: second, place: 2 },
    { s: first, place: 1 },
    { s: third, place: 3 },
  ];
  const height = { 1: "6.5rem", 2: "4.5rem", 3: "3.4rem" } as const;
  // Bronze, then silver, then gold — the tension goes up with each step.
  const delay = { 3: T_BODY + 0.1, 2: T_BODY + 0.28, 1: T_BODY + 0.5 } as const;

  return (
    <div className="relative mt-3">
      {/* The pool of light the podium stands in. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-6 left-1/2 h-24 w-[115%] -translate-x-1/2"
        style={{
          background: "radial-gradient(50% 50% at 50% 40%, rgba(255,230,160,0.22) 0%, transparent 70%)",
          animation: `sk-veil 1200ms ease-out ${T_BODY + 0.5}s both`,
        }}
      />
      <div className="relative flex items-end justify-center gap-1.5">
        {columns.map(({ s, place }) => {
          if (!s) return <div key={place} className="w-[31%]" />;
          const m = METAL[place];
          const champ = place === 1;
          return (
            <div key={place} className="flex w-[31%] flex-col items-center">
              {champ && (
                <span className="mb-4" style={{ color: GOLD, animation: `sk-rise 600ms ease-out ${delay[1] + 0.75}s both` }}>
                  <Glyph name="crown" className="h-7 w-7 drop-shadow-[0_2px_8px_rgba(226,181,61,0.7)]" />
                </span>
              )}
              <div className="relative">
                {champ && <Laurel delay={delay[1] + 0.55} />}
                <div
                  className="relative rounded-full p-[3px]"
                  style={{
                    background: m.face,
                    boxShadow: `0 12px 30px -10px ${m.glow}`,
                    animation: `sk-slap 760ms cubic-bezier(0.2, 1.2, 0.35, 1) ${delay[place] + 0.35}s both`,
                  }}
                >
                  <Avatar athlete={s.athlete} className={champ ? "h-[4.5rem] w-[4.5rem] text-xl" : "h-12 w-12 text-sm"} />
                </div>
              </div>
              <p className={`w-full truncate text-center font-semibold ${champ ? "mt-5 text-base" : "mt-2 text-[0.8125rem] text-white/85"}`}>
                {s.athlete.name}
              </p>
              <p className="font-mono text-[0.6875rem] text-white/55">
                {fmtPoints(s.points)}
                {s.athlete.id === meId && <span className="text-white/40"> · you</span>}
              </p>

              {/* The step. */}
              <div
                className="relative mt-2 w-full origin-bottom"
                style={{ animation: `sm-rise-up 640ms cubic-bezier(0.2, 1.15, 0.35, 1) ${delay[place]}s both` }}
              >
                {/* Lit top surface, in perspective. */}
                <div
                  aria-hidden
                  className="h-3"
                  style={{ background: m.lid, clipPath: "polygon(7% 0, 93% 0, 100% 100%, 0 100%)" }}
                />
                {/* Brushed front face. */}
                <div
                  className="relative flex items-start justify-center overflow-hidden pt-1"
                  style={{
                    height: height[place],
                    backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 3px), ${m.face}`,
                    boxShadow: "inset 10px 0 14px -10px rgba(0,0,0,0.45), inset -10px 0 14px -10px rgba(0,0,0,0.45)",
                  }}
                >
                  {/* Engraved: a dark numeral with a light edge beneath it. */}
                  <span
                    className="stamp leading-none"
                    style={{
                      fontSize: champ ? "3rem" : "2.25rem",
                      color: m.ink,
                      textShadow: "0 1px 0 rgba(255,255,255,0.35), 0 -1px 0 rgba(0,0,0,0.25)",
                    }}
                  >
                    {place}
                  </span>
                  {/* Light catching the metal as it settles. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.45) 50%, transparent 60%)",
                      backgroundSize: "260% 100%",
                      mixBlendMode: "soft-light",
                      animation: `sm-foil 3400ms ease-in-out ${delay[place] + 0.7}s infinite`,
                    }}
                  />
                </div>
                {/* Its reflection in the floor. */}
                <div
                  aria-hidden
                  className="h-7"
                  style={{
                    backgroundImage: m.face,
                    transform: "scaleY(-1)",
                    opacity: 0.18,
                    WebkitMask: "linear-gradient(0deg, #000, transparent)",
                    mask: "linear-gradient(0deg, #000, transparent)",
                  }}
                />
                {/* Dust off the landing. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-5 left-1/2 h-10 w-[140%] -translate-x-1/2 rounded-full"
                  style={{
                    background: `radial-gradient(closest-side, ${m.glow}, transparent)`,
                    animation: `sk-flare 900ms ease-out ${delay[place] + 0.45}s both`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A ticket with notched sides — the prize and the forfeit, spelled out. */
function Ticket({ kind, name, delay }: { kind: "free" | "host"; name: string; delay: number }) {
  const free = kind === "free";
  const notch = "radial-gradient(circle at 0 50%, transparent 7px, #000 7.5px) left / 51% 100% no-repeat, radial-gradient(circle at 100% 50%, transparent 7px, #000 7.5px) right / 51% 100% no-repeat";
  return (
    <div
      className="relative flex-1 px-4 py-2.5 text-center"
      style={{
        background: free ? GOLD_FILL : "linear-gradient(168deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))",
        color: free ? "#231a04" : "#fff",
        WebkitMask: notch,
        mask: notch,
        ...rise(delay),
      }}
    >
      {free && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.75) 50%, transparent 62%)",
            backgroundSize: "260% 100%",
            mixBlendMode: "soft-light",
            animation: `sm-foil 2800ms ease-in-out ${delay + 0.5}s infinite`,
          }}
        />
      )}
      <p className="relative font-mono text-[0.5625rem] font-semibold tracking-[0.16em] opacity-70">
        {free ? "EATS FREE" : "HOSTS THE POTLUCK"}
      </p>
      <p className="stamp relative mt-0.5 truncate text-xl leading-none">{name.toUpperCase()}</p>
      <span
        aria-hidden
        className="absolute inset-y-2 left-3 w-0 border-l border-dashed"
        style={{ borderColor: free ? "rgba(35,26,4,0.35)" : "rgba(255,255,255,0.25)" }}
      />
      <span
        aria-hidden
        className="absolute inset-y-2 right-3 w-0 border-l border-dashed"
        style={{ borderColor: free ? "rgba(35,26,4,0.35)" : "rgba(255,255,255,0.25)" }}
      />
    </div>
  );
}

// ── The card ─────────────────────────────────────────────────────────────────

export function SeasonMoment({
  moment,
  table,
  meId,
  onDismiss,
}: {
  moment: Moment;
  /** The season's standings, best first. */
  table: Standing[];
  meId?: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const { season } = moment;

  // champion
  const scored = table.filter((s) => s.points > 0);
  const champ = scored[0];
  const last = scored.length > 1 ? scored[scored.length - 1] : null;
  const me = table.find((s) => s.athlete.id === meId);
  const iWon = !!champ && champ.athlete.id === meId;
  const iHost = !!last && last.athlete.id === meId && !iWon;

  return (
    <Stage label={`${season.label} champion`} glow="rgba(226,181,61,0.28)" spotlight>
      {/* Light rays turning slowly behind the podium. */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[44%] -z-0 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2">
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, rgba(226,181,61,0.16) 0deg 7deg, transparent 7deg 22deg)",
            WebkitMask: "radial-gradient(circle, #000 0%, transparent 62%)",
            mask: "radial-gradient(circle, #000 0%, transparent 62%)",
            animation: "sm-spin 60s linear infinite, sk-veil 1600ms ease-out both",
          }}
        />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col justify-center">
        <Eyebrow delay={T_TOP}>{season.monthsLabel.replace("–", " – ").toUpperCase()} · FINAL TABLE</Eyebrow>
        <div className="mt-2 text-center">
          <p className="stamp leading-[0.95]" style={{ fontSize: "clamp(2.3rem, 11vw, 3.2rem)", animation: `sk-headline 760ms cubic-bezier(0.16, 1, 0.3, 1) ${T_HERO}s both` }}>
            SEASON <span style={goldText}>{season.number}</span>
          </p>
          <p className="stamp relative leading-[0.95]" style={{ fontSize: "clamp(2.3rem, 11vw, 3.2rem)", animation: `sk-headline 760ms cubic-bezier(0.16, 1, 0.3, 1) ${T_HERO + 0.25}s both` }}>
            <span style={{ ...goldText, filter: "drop-shadow(0 4px 22px rgba(226,181,61,0.4))" }}>CHAMPION</span>
            {/* One pass of light across the gold, the same move as the kickoff. */}
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage: "linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.9) 50%, transparent 58%)",
                backgroundSize: "260% 100%",
                backgroundPosition: "190% 0",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                animation: `sk-sheen 1400ms cubic-bezier(0.3, 0, 0.2, 1) ${T_HERO + 0.7}s both, sk-sheen 1400ms cubic-bezier(0.3, 0, 0.2, 1) ${T_HERO + 5}s both`,
              }}
            >
              CHAMPION
            </span>
          </p>
        </div>
        {/* Everything takes the hit when the gold step lands. */}
        <div className="mt-5" style={{ animation: `sk-jolt 520ms ease-out ${T_BODY + 1.02}s both` }}>
          <Podium table={table} meId={meId} />
        </div>
        {champ && (
          <div className="mt-5 flex gap-2.5">
            <Ticket kind="free" name={champ.athlete.name} delay={T_BODY + 1.35} />
            {last && <Ticket kind="host" name={last.athlete.name} delay={T_BODY + 1.47} />}
          </div>
        )}
      </div>
      <Outro delay={T_BODY + 1.2} button={`On to Season ${season.number + 1}`} onDismiss={onDismiss}>
        {iWon ? (
          <>That&rsquo;s you. Wear the <span className="font-semibold" style={{ color: GOLD }}>gold</span> all next season.</>
        ) : iHost ? (
          <>You finished last — <span className="font-semibold text-white">you&rsquo;re hosting the potluck</span>.</>
        ) : me && me.points > 0 ? (
          <>You finished {ordinal(me.rank)} of {scored.length}.</>
        ) : null}
      </Outro>
    </Stage>
  );
}
