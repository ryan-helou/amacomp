"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState } from "react";
import { CLUB_LIVE, CLUB_ROOMS, canSeeClub, roomsOf, type ClubHouse, type ClubRoom } from "@/lib/club";
import { Wallet } from "./Wallet";
import { TurnAround } from "./AthleteFigure";
import { CountryFlag } from "./CountryFlag";
import { AVATAR_ITEM_BY_ID, lookFor } from "@/lib/pixelAvatar";
import type { AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import type { League } from "./useLeague";

/**
 * The shop is its own chunk, fetched only when someone opens that room — so a
 * phone that never sees the Club never downloads the wardrobe either.
 */
const AvatarLocker = dynamic(() => import("@/components/AvatarLocker").then((m) => m.AvatarLocker), {
  ssr: false,
});

/**
 * The Club: tri coins, the shop, bets and challenges.
 *
 * The league sees the teaser. Ryan sees the rooms, on the real app, so the
 * thing can be judged on a phone and shown to people — see `canSeeClub`, and
 * read the note there about what a name check is worth.
 */
export function ClubTab({
  state,
  refDay,
  send,
  house = "club",
}: {
  state: AppState;
  refDay: DayKey;
  send: League["send"];
  /** Which half: what you own, or what you are playing against someone else. */
  house?: ClubHouse;
}) {
  const rooms = roomsOf(house);
  const [room, setRoom] = useState<ClubRoom>(rooms[0].id);

  // The teaser is what the league gets until the Club opens properly.
  if (!CLUB_LIVE && !canSeeClub(state.me?.name)) return <ClubTeaser />;

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={house === "club" ? "Club" : "Arena"}
        className="flex gap-1 rounded-xl pane border border-line bg-tile p-1"
      >
        {rooms.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={room === r.id}
            onClick={() => setRoom(r.id)}
            className={`eyebrow flex-1 rounded-lg py-2.5 transition-colors ${
              room === r.id ? "bg-ink text-on-ink" : "text-ink-2"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {room === "wallet" ? (
        <Wallet state={state} refDay={refDay} />
      ) : room === "shop" ? (
        <AvatarLocker state={state} refDay={refDay} send={send} />
      ) : room === "profile" ? (
        <ClubProfile state={state} />
      ) : (
        /* Bets and challenges land here as they're built. */
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-2">
          {CLUB_ROOMS.find((r) => r.id === room)?.blurb}
          <br />
          <span className="text-ink-3">Being built.</span>
        </p>
      )}
    </div>
  );
}

/**
 * The teaser the league sees on the deployed app.
 *
 * A coming-soon screen that's only the words "coming soon" is a dead tab, so
 * this shows the coin, what it's for and how it's earned. The point is that
 * someone opens it, understands the game, and starts caring about their points
 * twice over before a single coin exists.
 */
function ClubTeaser() {
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl pane border border-gold/40 px-5 py-8 text-center">
        {/* A soft gold pool behind the coin, so the hero reads as minted rather
            than as an image dropped on the deck. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--color-gold) 22%, transparent) 0%, transparent 70%)",
          }}
        />
        <div className="relative">
          <div className="mx-auto h-28 w-28 coin-spin">
            <Image
              src="/tri-coin.png"
              alt="A tri coin"
              width={256}
              height={256}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <h2 className="stamp mt-4 text-2xl text-gold">TRI COINS</h2>
          <p className="mx-auto mt-2 max-w-[19rem] text-[0.875rem] text-ink-2">
            A second currency, landing soon. Every point you score mints one coin — and coins
            never touch the standings.
          </p>
          <span className="eyebrow mt-4 inline-block rounded-full border border-gold/50 px-3 py-1.5 text-gold">
            Coming soon
          </span>
        </div>
      </section>

      <section>
        <h3 className="eyebrow text-ink-3">What you&rsquo;ll do with them</h3>
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl pane border border-line bg-tile">
          {CLUB_ROOMS.filter((r) => r.id !== "wallet").map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[0.9375rem] font-semibold text-ink">{r.label}</span>
                <span className="eyebrow shrink-0 text-ink-3">Soon</span>
              </div>
              <p className="mt-0.5 text-[0.8125rem] text-ink-2">{r.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="eyebrow text-ink-3">How you&rsquo;ll earn them</h3>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {/* Training does the work: a week win is worth about a third of a
              decent week's points, so the bonuses can't carry anyone. */}
          {[
            { what: "Every point", coins: "1" },
            { what: "Hit your quota", coins: "25" },
            { what: "Win the week", coins: "50" },
            { what: "Win the month", coins: "100" },
            { what: "Win the season", coins: "250" },
            { what: "Speed or power record", coins: "25" },
          ].map((row) => (
            <li
              key={row.what}
              className="flex items-center justify-between gap-2 rounded-xl pane border border-line bg-tile px-3 py-2.5"
            >
              <span className="text-[0.8125rem] text-ink-2">{row.what}</span>
              <span className="stamp shrink-0 text-lg tabular-nums text-gold">{row.coins}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-center text-xs text-ink-3">
          Backdated to 3 August, so nothing you&rsquo;ve already done goes unpaid.
        </p>
      </section>
    </div>
  );
}

/**
 * Your own figure, front and back, and the flag you fly.
 *
 * The shop shows you an item at a time; this shows the whole of what you have
 * put together, which is the thing everyone else sees on the board.
 */
function ClubProfile({ state }: { state: AppState }) {
  const me = state.me;
  if (!me) return null;
  const worn = lookFor(me, state.loadouts);
  const flag = AVATAR_ITEM_BY_ID.get(worn.flag?.item ?? "");
  const kit = ["head", "eyes", "torso", "legs", "feet", "socks", "prize"]
    .map((slot) => AVATAR_ITEM_BY_ID.get(worn[slot]?.item ?? ""))
    .filter((i): i is NonNullable<typeof i> => !!i && !!i.sprite);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-line bg-tile">
        <TurnAround athlete={me} loadouts={state.loadouts} className="w-24" />
      </div>
      <div className="rounded-2xl border border-line bg-tile px-4 py-3">
        <p className="eyebrow text-ink-3">Flying</p>
        <p className="mt-1 flex items-center gap-2 text-sm text-ink">
          {flag?.flag ? (
            <>
              <CountryFlag id={flag.flag} />
              {flag.label}
            </>
          ) : (
            <span className="text-ink-2">No flag yet — the shop has nine.</span>
          )}
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-tile px-4 py-3">
        <p className="eyebrow text-ink-3">Wearing</p>
        {kit.length === 0 ? (
          <p className="mt-1 text-sm text-ink-2">Nothing but the starter kit.</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-ink-2">
            {kit.map((i) => (
              <li key={i.id}>{i.label}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
