"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { SeasonInfo } from "@/lib/season";
import { loadoutFor, type Loadout } from "@/lib/pixelAvatar";
import { flagLane } from "@/lib/flags";
import { PixelAvatar } from "./PixelAvatar";
import { Glyph, type GlyphName } from "./Glyph";
import { Snow, useFestive } from "./Festive";

/**
 * The season kickoff — the one screen where the app goes dark.
 *
 * Page one is a title card, not a roster: SEASON / n / STARTS NOW, and then the
 * lads get slapped on like a die-cut sticker, hard enough to knock the whole
 * card sideways. Deliberately no confetti — that already means "someone hit
 * quota", and reusing it would cost both moments their meaning.
 *
 * Behind the arrow is what changed since last season. Ryan's call, 2026-10-02:
 * a season's worth of new things landed between Season 1 and Season 2, and
 * five men who have never seen any of it open the app on Monday. A list in a
 * message gets skimmed; a card you tap through gets read.
 *
 * The cards show the real thing wherever they can — actual pixel figures, an
 * actual flag lane — rather than an icon standing in for it. The point of
 * announcing a character is that you see your own.
 */

/** The league's gold, in one place — the same value the title card uses. */
const GOLD = "#e2b53d";

/**
 * The way-forward button, in gold rather than the app's accent.
 *
 * `--accent` is a near-white (#f1f2f3 on the default palette), which on this
 * ink ground reads as a grey slab — and the card is already gold: the numeral,
 * the dots, the icon chips. The one thing you are meant to press should be the
 * same colour as everything else that matters here.
 */
const GOLD_FILL = "linear-gradient(168deg, #ffeaa4 0%, #e2b53d 46%, #b98d09 100%)";

const goldButton: CSSProperties = {
  backgroundImage: GOLD_FILL,
  color: "#2a1d00",
  boxShadow: "0 10px 28px -10px rgba(226,181,61,0.6), inset 0 1px 0 0 rgba(255,255,255,0.35)",
};

// Beat sheet, in seconds.
const T_LINE1 = 0.25;
const T_LINE2 = 0.62;
const T_MONTHS = 0.98;
const T_SLAP = 1.3;
const T_OUTRO = 2.2;

// Both title lines share one size so they read as a single stacked lockup.
const TITLE_SIZE = "clamp(1.9rem, 9.5vw, 2.9rem)";

export function SeasonKickoff({
  season,
  news = true,
  onDismiss,
}: {
  season: SeasonInfo;
  /** Whether what's-new sits behind the arrow. Off for a quiet season. */
  news?: boolean;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  // Which page. 0 is the title card; the rest are what changed.
  const [page, setPage] = useState(0);
  // At Christmas the card leaves the pool for a winter night: pine instead of
  // pool-deck ink, cranberry light from above, and snow (lib/festive).
  const { on: festive } = useFestive();
  const last = news ? NEWS.length : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${season.label} starts now`}
      className="fixed inset-0 z-[60] overflow-hidden text-white"
      style={{
        // Deep pool-deck ink — the app's own colour taken down for the night.
        backgroundColor: festive ? "#0a1811" : "#081722",
        animation: "sk-veil 420ms ease-out both",
      }}
    >
      {/* Pool light from above, and caustics moving underneath it. Three slabs
          on different periods so the pattern never repeats the same way. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            festive
              ? "radial-gradient(115% 55% at 50% -10%, rgba(226,58,68,0.34) 0%, transparent 55%)," +
                "radial-gradient(90% 45% at 50% 108%, rgba(47,191,106,0.22) 0%, transparent 60%)"
              : "radial-gradient(115% 55% at 50% -10%, rgba(61,90,255,0.30) 0%, transparent 55%)," +
                "radial-gradient(90% 45% at 50% 108%, rgba(176,131,7,0.20) 0%, transparent 60%)",
        }}
      />
      {festive && <Snow />}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        // Christmas turns the pool's blues and violets to pine and cranberry.
        style={festive ? { filter: "hue-rotate(150deg) saturate(1.1)" } : undefined}
      >
        <div
          className="absolute inset-[-25%]"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(61,140,220,0.30), transparent 70%)," +
              "radial-gradient(closest-side, rgba(90,200,230,0.22), transparent 70%)",
            backgroundSize: "58% 42%, 44% 34%",
            backgroundPosition: "12% 22%, 74% 58%",
            backgroundRepeat: "no-repeat",
            filter: "blur(38px)",
            animation: "sk-caustic-a 19s ease-in-out infinite",
          }}
        />
        <div
          className="absolute inset-[-25%]"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(139,61,245,0.24), transparent 70%)," +
              "radial-gradient(closest-side, rgba(61,90,255,0.22), transparent 70%)",
            backgroundSize: "50% 38%, 62% 46%",
            backgroundPosition: "82% 14%, 24% 78%",
            backgroundRepeat: "no-repeat",
            filter: "blur(46px)",
            animation: "sk-caustic-b 26s ease-in-out infinite",
          }}
        />
        <div
          className="absolute inset-[-25%]"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(226,181,61,0.20), transparent 70%)",
            backgroundSize: "54% 40%",
            backgroundPosition: "50% 8%",
            backgroundRepeat: "no-repeat",
            filter: "blur(52px)",
            animation: "sk-caustic-c 33s ease-in-out infinite",
          }}
        />
      </div>

      {/* Cinematic framing — pulls the eye to the middle of the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 75% at 50% 42%, transparent 38%, rgba(3,10,16,0.74) 100%)",
        }}
      />

      {/* One pass of light, riding out on the impact. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.16) 45%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0.16) 55%, transparent)",
          filter: "blur(6px)",
          animation: `sk-sweep 1000ms cubic-bezier(0.4, 0, 0.2, 1) ${T_SLAP + 0.1}s both`,
        }}
      />

      {/* Everything inside takes the hit when the sticker lands. */}
      {page === 0 ? (
      <div
        className="relative h-full"
        style={{ animation: `sk-jolt 520ms ease-out ${T_SLAP + 0.28}s both` }}
      >
        <div className="flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
          {/* ── Title ──────────────────────────────────────────────── */}
          <div className="relative shrink-0 pt-4 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(176,131,7,0.75) 0%, transparent 68%)",
                filter: "blur(26px)",
                animation: `sk-flare 900ms ease-out ${T_LINE1 - 0.1}s both`,
              }}
            />
            {/* Two lines, one size — SEASON n / STARTS NOW reads as a single
                stacked lockup. The numeral keeps the gold so the season still
                carries the accent, and a specular band sweeps the line once.
                The gold sits on its own layer and the sheen is a second,
                mostly-transparent copy on top: sweeping the base gradient
                itself parks the text on whatever stop the animation ends on. */}
            <div
              className="stamp relative leading-[1.02] text-white"
              style={{
                fontSize: TITLE_SIZE,
                letterSpacing: "0.02em",
                animation: `sk-headline 760ms cubic-bezier(0.16, 1, 0.3, 1) ${T_LINE1}s both`,
              }}
            >
              <span>SEASON </span>
              <span
                style={{
                  backgroundImage:
                    "linear-gradient(168deg, #ffeaa4 0%, #e2b53d 46%, #b98d09 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  filter: "drop-shadow(0 3px 16px rgba(226,181,61,0.45))",
                }}
              >
                {season.number}
              </span>
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.85) 50%, transparent 58%)",
                  backgroundSize: "260% 100%",
                  backgroundPosition: "190% 0",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  animation: `sk-sheen 1400ms cubic-bezier(0.3, 0, 0.2, 1) ${
                    T_LINE1 + 0.35
                  }s both`,
                }}
              >
                SEASON {season.number}
              </span>
            </div>

            <p
              className="stamp relative leading-[1.02] text-white"
              style={{
                fontSize: TITLE_SIZE,
                letterSpacing: "0.02em",
                animation: `sk-headline 760ms cubic-bezier(0.16, 1, 0.3, 1) ${T_LINE2}s both`,
              }}
            >
              STARTS NOW
            </p>
            <p
              className="relative mt-2 font-mono text-xs tracking-[0.2em] text-white/45"
              style={{ animation: `sk-rise 600ms ease-out ${T_MONTHS}s both` }}
            >
              {season.monthsLabel.replace("–", " – ").toUpperCase()}
            </p>
          </div>

          {/* ── The lads ───────────────────────────────────────────── */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center py-3">
            {/* Shockwave off the impact. */}
            <div
              aria-hidden
              className="pointer-events-none absolute h-52 w-52 rounded-full"
              style={{
                border: "3px solid rgba(226,181,61,0.85)",
                animation: `sk-shock 850ms cubic-bezier(0.16, 1, 0.3, 1) ${
                  T_SLAP + 0.24
                }s both`,
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- static same-origin sticker, next/image adds nothing here */}
            <img
              src="/lads.webp"
              alt=""
              aria-hidden
              className="relative max-h-full w-auto object-contain"
              style={{
                // Stacked white shadows build the die-cut sticker edge; the last
                // one is the shadow it casts on the deck.
                filter:
                  "drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff)" +
                  " drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff)" +
                  " drop-shadow(0 14px 22px rgba(0,0,0,0.55))",
                animation: `sk-slap 780ms cubic-bezier(0.2, 1.2, 0.35, 1) ${T_SLAP}s both`,
              }}
            />
          </div>

          {/* ── Stakes + way in ────────────────────────────────────── */}
          <div
            className="shrink-0 pt-4"
            style={{ animation: `sk-rise 640ms ease-out ${T_OUTRO}s both` }}
          >
            <p className="text-center text-[0.9375rem] leading-relaxed text-white/60">
              Two months. Winner eats free and wears{" "}
              <span className="font-semibold" style={{ color: "#e2b53d" }}>
                gold
              </span>{" "}
              all next season. Last place hosts the potluck.
            </p>
            <button
              onClick={() => (last ? setPage(1) : onDismiss())}
              autoFocus
              style={goldButton}
              className="eyebrow mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4"
            >
              {last ? "What's new" : "Take your lane"}
              {last > 0 && <Arrow />}
            </button>
          </div>
        </div>
      </div>
      ) : (
        <NewsPage
          card={NEWS[page - 1]}
          index={page - 1}
          count={last}
          onBack={() => setPage(page - 1)}
          onNext={() => (page < last ? setPage(page + 1) : onDismiss())}
        />
      )}
    </div>
  );
}

/** The chevron that carries the whole flow. */
function Arrow({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

interface Card {
  /** The label above the headline — what KIND of news this is. */
  eyebrow: string;
  title: string;
  /** One sentence that says what it is. Not a feature list. */
  blurb: string;
  /** The three or four things worth knowing, each a line. */
  points: { icon: GlyphName; text: ReactNode }[];
  /** The real thing, drawn. Null where there is nothing honest to show. */
  art?: ReactNode;
}

/** Four figures off the real generator, so nobody is looking at a mock-up. */
function Figures() {
  const cast: [string, Partial<Loadout>][] = [
    ["Jona", { torso: { item: "torso.hoops.phi" }, head: { item: "head.durag.black" } }],
    ["Philippe", { torso: { item: "torso.jersey.gold" }, eyes: { item: "eyes.shades.black" } }],
    ["Jonah", { torso: { item: "torso.gi" }, head: { item: "head.bucket.olive" } }],
    ["Alberto", { torso: { item: "torso.trisuit.cyan" }, head: { item: "head.aero.gold" } }],
  ];
  return (
    <div className="flex items-end justify-center gap-1">
      {cast.map(([name, kit], i) => (
        <span
          key={name}
          className="w-[21%] max-w-[86px]"
          style={{ animation: `sk-rise 520ms ease-out ${0.35 + i * 0.09}s both` }}
        >
          <PixelAvatar
            loadout={{ ...loadoutFor(name), flag: { item: "flag.none" }, ...kit } as Loadout}
            flat
            className="w-full"
          />
        </span>
      ))}
    </div>
  );
}

/** A real lane, built by the same code that paints one behind a board row. */
function Lane({ flag, name }: { flag: string; name: string }) {
  return (
    <div
      className="flex items-center gap-2 overflow-hidden rounded-xl px-3 py-2"
      style={flagLane(flag) as React.CSSProperties}
    >
      <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-black/20">
        <PixelAvatar
          loadout={{ ...loadoutFor(name), flag: { item: `flag.${flag}` } } as Loadout}
          bust flat className="h-full w-full"
        />
      </span>
      <span className="text-sm" style={{ color: "var(--ink, #fff)" }}>{name}</span>
      <span className="ml-auto stamp text-sm" style={{ color: "var(--ink, #fff)" }}>412</span>
    </div>
  );
}

/** The coin itself, the same file the wallet and the shop use. */
function Coin() {
  return (
    <div className="relative flex items-center justify-center py-1">
      <div
        aria-hidden
        className="pointer-events-none absolute h-40 w-40 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(226,181,61,0.45) 0%, transparent 66%)",
          filter: "blur(18px)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- static same-origin asset */}
      <img
        src="/tri-coin.png"
        alt=""
        aria-hidden
        className="relative h-28 w-28 object-contain"
        style={{ filter: "drop-shadow(0 12px 22px rgba(0,0,0,0.5))" }}
      />
    </div>
  );
}

/**
 * A bet, drawn as the card it actually is: two men, a stake between them.
 *
 * Built from the app's own pieces rather than an icon of a handshake — the
 * thing being announced is that you can put coins on your mate, and two
 * figures either side of a number says that without a caption.
 */
function BetCard() {
  const faces: [string, string][] = [["Jona", "torso.jersey.magenta"], ["Philippe", "torso.tee.white"]];
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
      {faces.map(([name, kit], i) => (
        <span key={name} className="flex flex-1 flex-col items-center gap-1">
          <span className="h-11 w-11 overflow-hidden rounded-full bg-black/25">
            <PixelAvatar
              loadout={{ ...loadoutFor(name), torso: { item: kit }, flag: { item: "flag.none" } } as Loadout}
              bust flat className="h-full w-full"
            />
          </span>
          <span className="font-mono text-[0.625rem] text-white/50">{i === 0 ? "You" : name}</span>
        </span>
      ))}
      <span className="flex shrink-0 flex-col items-center">
        <span className="stamp text-xl leading-none" style={{ color: GOLD }}>150</span>
        <span className="font-mono text-[0.5625rem] tracking-[0.15em] text-white/35">ON IT</span>
      </span>
    </div>
  );
}

/** The podium, with the real prizes on real figures. */
function Podium() {
  const steps: [string, string, string][] = [
    ["Philippe", "prize.silver", "2nd"],
    ["Jona", "prize.crown", "1st"],
    ["Jonah", "prize.bronze", "3rd"],
  ];
  return (
    <div className="flex items-end justify-center gap-2">
      {steps.map(([name, prize, place]) => (
        <span key={name} className="flex flex-col items-center gap-1" style={{ width: "27%", maxWidth: 92 }}>
          <PixelAvatar
            loadout={{ ...loadoutFor(name), prize: { item: prize }, flag: { item: "flag.none" } } as Loadout}
            flat
            className={place === "1st" ? "w-full" : "w-[86%]"}
            gilded={place === "1st"}
          />
          <span
            className="w-full rounded-t-md text-center font-mono text-[0.625rem] leading-[1.9]"
            style={{
              height: place === "1st" ? 30 : place === "2nd" ? 22 : 16,
              background: "rgba(255,255,255,0.07)",
              color: place === "1st" ? GOLD : "rgba(255,255,255,0.45)",
            }}
          >
            {place}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * A man cut out and slapped on — the same die-cut sticker the lads get on the
 * title card, so each new arrival turns up the way the rest of them did.
 *
 * The cutout is the photo with its background lifted off (Vision's foreground
 * mask), not a rounded frame: a frame around a face is a passport photo, and
 * the card already has one picture in a box on every other page.
 */
function Cutout({ src, alt, delay = 0.3 }: { src: string; alt: string; delay?: number }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- static same-origin asset */
    <img
      src={src}
      alt={alt}
      className="relative h-44 w-auto object-contain sm:h-52"
      style={{
        // Stacked white shadows build the sticker edge; the last is the
        // shadow it casts. Same recipe as the lads on page one.
        filter:
          "drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff)" +
          " drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff)" +
          " drop-shadow(0 16px 26px rgba(0,0,0,0.6))",
        animation: `sk-slap 700ms cubic-bezier(0.2, 1.2, 0.35, 1) ${delay}s both`,
      }}
    />
  );
}

/** The new men, side by side, over one shared gold wash. */
function NewMen() {
  return (
    <div className="relative flex items-end justify-center gap-2">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-48 w-64 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(226,181,61,0.38) 0%, transparent 68%)",
          filter: "blur(22px)",
        }}
      />
      <Cutout src="/george.webp" alt="George" delay={0.3} />
      <Cutout src="/jamal.webp" alt="Jamal" delay={0.42} />
    </div>
  );
}

const NEWS: Card[] = [
  // Coins first, Ryan's call 2026-10-02. They are the thing the rest of it
  // hangs off — a character you cannot dress and a bet you cannot stake are
  // both answered by "where do I get the money", so answer that first.
  {
    eyebrow: "New in Season 2",
    title: "Tri coins",
    blurb: "Every point you score mints a coin. Coins never touch the standings.",
    points: [
      { icon: "bolt", text: <>One coin a point, <b>+25</b> for hitting quota.</> },
      { icon: "trophy", text: <>Win a week <b>+50</b>, a month <b>+100</b>, the season <b>+250</b>.</> },
      { icon: "diamond", text: "They buy what your man wears — 80-odd things on the shelf." },
      { icon: "heart", text: "Send them to anyone, or buy somebody something outright." },
    ],
    art: <Coin />,
  },
  {
    eyebrow: "New in Season 2",
    title: "You have a character",
    blurb:
      "Everyone gets a little man of his own, and he turns up wherever your name does.",
    points: [
      { icon: "star", text: "Yours is built from your name, so it was already waiting for you." },
      { icon: "trio", text: "He stands on the Board, the Week and your profile." },
      { icon: "flag", text: "Fly your country and it washes your lane on the Board." },
    ],
    art: (
      <div className="space-y-3">
        <Figures />
        <Lane flag="lb" name="Jona" />
      </div>
    ),
  },
  {
    eyebrow: "New in Season 2",
    title: "The Arena",
    blurb: "Stake coins against each other, or put a bounty up for the whole league.",
    points: [
      { icon: "trio", text: "Bet on points, distance or one discipline — the board settles it, nobody argues." },
      { icon: "chat", text: "Or bet on anything at all: one of you calls it, the other agrees." },
      { icon: "target", text: "Bounties are tasks with coins on them. First man to do it takes them." },
    ],
    art: <BetCard />,
  },
  {
    eyebrow: "New in Season 2",
    title: "The podium",
    blurb: "Winning is worth something you can see on your man.",
    points: [
      { icon: "medal", text: "A medal for a week, a sash for a month." },
      { icon: "crown", text: "The champion wears the crown all next season — and a gold outline, everywhere." },
      { icon: "shield", text: "Second and third get a circlet, in silver and in bronze." },
    ],
    art: <Podium />,
  },
  {
    eyebrow: "And two more",
    title: "George and Jamal are in",
    blurb: "Eight of us this season. They start on zero like everybody else.",
    points: [
      { icon: "footprints", text: "Same quota, same forfeit, no grace for being new." },
      { icon: "rings", text: "Which also means two more men between you and the crown." },
    ],
    art: <NewMen />,
  },
];

function NewsPage({
  card, index, count, onBack, onNext,
}: {
  card: Card;
  index: number;
  count: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const lastOne = index === count - 1;
  return (
    <div className="relative flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="flex min-h-0 flex-1 flex-col justify-center py-2">
        <p
          className="font-mono text-[0.6875rem] tracking-[0.22em] text-white/40"
          style={{ animation: "sk-rise 420ms ease-out 0.05s both" }}
        >
          {card.eyebrow.toUpperCase()}
        </p>
        <h2
          className="stamp mt-1.5 leading-[1.05] text-white"
          style={{
            fontSize: "clamp(1.6rem, 7.5vw, 2.25rem)",
            animation: "sk-headline 600ms cubic-bezier(0.16, 1, 0.3, 1) 0.12s both",
          }}
        >
          {card.title}
        </h2>
        <p
          className="mt-2.5 text-[0.9375rem] leading-relaxed text-white/60"
          style={{ animation: "sk-rise 520ms ease-out 0.22s both" }}
        >
          {card.blurb}
        </p>

        {card.art && (
          <div className="mt-5" style={{ animation: "sk-rise 560ms ease-out 0.3s both" }}>
            {card.art}
          </div>
        )}

        <ul className="mt-5 space-y-3">
          {card.points.map((p, i) => (
            <li
              key={i}
              className="flex items-start gap-3"
              style={{ animation: `sk-rise 480ms ease-out ${0.36 + i * 0.08}s both` }}
            >
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "rgba(226,181,61,0.14)", color: GOLD }}
              >
                <Glyph name={p.icon} className="h-4 w-4" />
              </span>
              <span className="text-[0.875rem] leading-relaxed text-white/80">{p.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Where you are, and the way on. The dots are the only thing that says
          how much is left — a card with no end in sight gets skipped. */}
      <div className="shrink-0 pt-4" style={{ animation: "sk-rise 520ms ease-out 0.5s both" }}>
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? 18 : 6,
                background: i === index ? GOLD : "rgba(255,255,255,0.22)",
              }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            aria-label="Back"
            className="eyebrow flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-white/15 text-white/60"
          >
            <Arrow className="h-4 w-4 rotate-180" />
          </button>
          <button
            onClick={onNext}
            autoFocus
            style={goldButton}
            className="eyebrow flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-4"
          >
            {lastOne ? "Take your lane" : "Next"}
            {!lastOne && <Arrow />}
          </button>
        </div>
      </div>
    </div>
  );
}
