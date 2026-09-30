"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CLUB_LIVE, CLUB_ROOMS, canSeeClub, roomsOf, type ClubHouse, type ClubRoom } from "@/lib/club";
import { Wallet } from "./Wallet";
import { TurnAround } from "./AthleteFigure";
import { CountryFlag } from "./CountryFlag";
import { AVATAR_ITEM_BY_ID, lookFor } from "@/lib/pixelAvatar";
import { SPORT_ORDER, activityPoints, fmtKm, fmtPoints, totalPoints, unscoredGymIds } from "@/lib/scoring";
import { championshipsByAthlete, streakFor } from "@/lib/achievements";
import { SPORT_UI } from "@/lib/ui";
import { SPORT_UNIT, isGrant, type Sport } from "@/lib/types";
import { daysBetween, weekStart } from "@/lib/dates";
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
        <ClubProfile state={state} refDay={refDay} />
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
function ClubProfile({
  state,
  refDay,
}: {
  state: AppState;
  refDay: DayKey;
}) {
  const me = state.me;
  const stats = useMemo(() => (me ? careerStats(me.id, state, refDay) : null), [me, state, refDay]);
  if (!me || !stats) return null;

  const worn = lookFor(me, state.loadouts);
  const flag = AVATAR_ITEM_BY_ID.get(worn.flag?.item ?? "");

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-line bg-tile">
        <TurnAround athlete={me} loadouts={state.loadouts} className="w-24" />
        <p className="border-t border-line px-4 py-2.5 text-center text-sm text-ink-2">
          {flag?.flag ? (
            <span className="inline-flex items-center gap-2 text-ink">
              <CountryFlag id={flag.flag} />
              Flying {flag.label}
            </span>
          ) : (
            "No flag yet — the shop has nine."
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Points" value={fmtPoints(stats.points)} />
        <Tile label="Sessions" value={String(stats.sessions)} />
        <Tile label="Active days" value={String(stats.activeDays)} />
      </div>

      <Panel title="Career distance">
        <ul className="space-y-1.5">
          {SPORT_ORDER.filter((sp) => SPORT_UNIT[sp] === "km").map((sp) => (
            <li key={sp} className="flex items-baseline justify-between gap-3">
              <span className={`eyebrow ${SPORT_UI[sp].text}`}>{SPORT_UI[sp].label}</span>
              <span className="font-mono text-sm text-ink">{fmtKm(stats.km[sp])} km</span>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-3">
            <span className={`eyebrow ${SPORT_UI.gym.text}`}>Gym</span>
            <span className="font-mono text-sm text-ink">{stats.gym} workouts</span>
          </li>
        </ul>
      </Panel>

      {/* The numbers above are true but they are not a feeling. These are the
          same numbers held up against something a person can picture. */}
      <Panel title="Which is to say">
        <ul className="space-y-1.5 text-sm text-ink-2">
          {stats.feats.map((f) => (
            <li key={f.line}>
              <span className="font-mono text-ink">{f.big}</span> {f.line}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid grid-cols-2 gap-2">
        <Tile label="Best week" value={fmtPoints(stats.bestWeek)} sub="pts" />
        <Tile label="Best day" value={fmtPoints(stats.bestDay)} sub="pts" />
        <Tile label="Longest session" value={fmtKm(stats.longest.km)} sub={stats.longest.label} />
        <Tile label="Biggest climb" value={String(Math.round(stats.bigClimb))} sub="m in a session" />
      </div>

      <Panel title="Form">
        <ul className="space-y-1.5 text-sm">
          <Line label="Current streak" value={`${stats.streak.current} wk`} />
          <Line label="Best streak" value={`${stats.streak.best} wk`} />
          <Line label="Weeks won" value={String(stats.titles)} />
          <Line label="Busiest day" value={stats.busiestDay} />
          <Line label="Favourite" value={SPORT_UI[stats.favourite].label} />
          <Line label="Since first session" value={`${stats.daysIn} days`} />
        </ul>
      </Panel>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-tile px-3 py-2.5">
      <p className="stamp text-2xl leading-none text-ink">{value}</p>
      <p className="eyebrow mt-1 text-ink-3">
        {label}
        {sub ? <span className="ml-1 normal-case text-ink-3">{sub}</span> : null}
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-tile px-4 py-3">
      <p className="eyebrow text-ink-3">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-ink-2">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </li>
  );
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Everything the Profile shows, worked out in one pass.
 *
 * Grants are excluded from anything about EFFORT — a coin handed over is not a
 * kilometre — but they still count toward points, because they are points.
 */
function careerStats(athleteId: string, state: AppState, refDay: DayKey) {
  const { settings } = state;
  const mine = state.activities.filter((a) => a.athleteId === athleteId);
  const real = mine.filter((a) => !isGrant(a));
  const unscored = unscoredGymIds(state.activities);

  const km: Record<Sport, number> = { swim: 0, bike: 0, run: 0, gym: 0 };
  const bySport: Record<Sport, number> = { swim: 0, bike: 0, run: 0, gym: 0 };
  const byDay = new Map<string, number>();
  const byWeek = new Map<string, number>();
  const dow = [0, 0, 0, 0, 0, 0, 0];
  let ascent = 0;
  let gym = 0;
  let bigClimb = 0;
  let longest = { km: 0, label: "—" };

  for (const a of mine) {
    const pts = activityPoints(a, settings, unscored);
    byDay.set(a.occurredOn, (byDay.get(a.occurredOn) ?? 0) + pts);
    const wk = weekStart(a.occurredOn as DayKey);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + pts);
    if (isGrant(a)) continue;
    bySport[a.sport] += pts;
    dow[new Date(`${a.occurredOn}T12:00:00`).getDay()] += 1;
    if (SPORT_UNIT[a.sport] === "km") {
      km[a.sport] += a.km;
      if (a.km > longest.km) longest = { km: a.km, label: SPORT_UI[a.sport].label.toLowerCase() };
    } else {
      gym += 1;
    }
    ascent += a.elevationM ?? 0;
    if ((a.elevationM ?? 0) > bigClimb) bigClimb = a.elevationM ?? 0;
  }

  const days = [...byDay.keys()].sort();
  const feats: { big: string; line: string }[] = [];
  // Everest is 8,849 m from the sea, and the number people know.
  if (ascent > 0) feats.push({ big: `${(ascent / 8849).toFixed(2)}×`, line: `up Everest — ${Math.round(ascent).toLocaleString()} m climbed` });
  if (km.run > 0) feats.push({ big: `${(km.run / 42.195).toFixed(1)}`, line: "marathons, if the running were laid end to end" });
  if (km.bike > 0) feats.push({ big: `${((km.bike / 40075) * 100).toFixed(2)}%`, line: "of the way around the world on the bike" });
  if (km.swim > 0) feats.push({ big: `${Math.round((km.swim * 1000) / 25).toLocaleString()}`, line: "lengths of a 25 m pool" });
  const total = km.swim + km.bike + km.run;
  if (total > 0) feats.push({ big: `${fmtKm(total)} km`, line: "under your own power, all in" });

  return {
    points: totalPoints(mine, settings),
    sessions: real.length,
    activeDays: days.length,
    km,
    gym,
    ascent,
    bigClimb,
    longest,
    feats,
    bestDay: Math.max(0, ...byDay.values()),
    bestWeek: Math.max(0, ...byWeek.values()),
    streak: streakFor(athleteId, state.activities, settings, refDay, state.me?.name),
    titles: championshipsByAthlete(state.athletes, state.activities, settings, refDay).get(athleteId) ?? 0,
    busiestDay: DAY_NAMES[dow.indexOf(Math.max(...dow))] ?? "—",
    favourite: (SPORT_ORDER.reduce((best, sp) => (bySport[sp] > bySport[best] ? sp : best), "run" as Sport)),
    daysIn: days.length === 0 ? 0 : daysBetween(days[0] as DayKey, refDay),
  };
}
