import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { readState } from "@/lib/state";
import { pushEnabled, sendToAthlete } from "@/lib/push";
import { standingsFor, standingsForRange, fmtPoints } from "@/lib/scoring";
import { addDays, leagueToday, parseDayKey, weekStart } from "@/lib/dates";
import { lastWeekRecap } from "@/lib/achievements";
import { runStravaTick } from "@/lib/tick";
import { seasonByNumber, seasonFor } from "@/lib/season";

export const dynamic = "force-dynamic";

/**
 * Scheduled work, triggered by an external cron (GitHub Actions) hitting this
 * endpoint with the shared secret. The notify jobs are idempotent per week via
 * the `meta` store, so a double-fire never double-notifies.
 *   ?job=strava   — every 30 min: pull each linked athlete's new activities, and
 *                   fill in a few personal bests from their streams
 *   ?job=midweek  — Thursday: nudge whoever's last or off the quota pace
 *   ?job=season   — daily: announce a new season + crown the last one's champion,
 *                   and warn everyone as a season closes
 *   ?job=results  — Monday: last week's champion + forfeit list
 *   ?job=deadline — Sunday: who still hasn't hit quota
 */
/**
 * League-wide announcements, newest last. `job=announce` sends the newest one,
 * once. Add a new entry to announce something new.
 */
const ANNOUNCEMENTS: { id: string; title: string; body: string }[] = [
  {
    // Ryan, 2026-10-10: "Push" — to go with the in-app card for the change.
    id: "bike-climb-33",
    title: "Bike climbing: 1 point per 33 m",
    body: "Up from 1 per 100 m — and it counts backwards. Every ride you've ever logged has been rescored, so check your points.",
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = url.searchParams.get("job");
  const store = getStore();

  // Strava polling stands alone — it doesn't need push configured, and it reads
  // per-connection rather than the whole app state.
  // The app schedules this itself now (see instrumentation.ts); this endpoint
  // stays as a backup trigger and a way to force a sync by hand. The tick is
  // idempotent, so both firing is harmless.
  if (job === "strava") {
    return NextResponse.json(await runStravaTick());
  }

  if (!pushEnabled()) {
    return NextResponse.json({ ok: true, skipped: "push not configured" });
  }

  const state = await readState();
  const now = leagueToday();
  const activities = state.activities;

  // One-off messages to the whole league. The text lives here, in git — it is
  // never taken from the request — and each id sends once, behind a marker,
  // so a second call (or a retry) can't send it twice.
  if (job === "announce") {
    const a = ANNOUNCEMENTS[ANNOUNCEMENTS.length - 1];
    const marker = `announce-${a.id}`;
    if (await store.getMeta(marker)) {
      return NextResponse.json({ ok: true, skipped: "already sent", id: a.id });
    }
    await store.setMeta(marker, "1");
    for (const athlete of state.athletes) {
      await sendToAthlete(athlete.id, { title: a.title, body: a.body, url: "/", tag: `announce-${a.id}` });
    }
    return NextResponse.json({ ok: true, id: a.id, athletes: state.athletes.length });
  }

  if (job === "results") {
    const recap = lastWeekRecap(state.athletes, activities, state.settings, now);
    if (!recap) return NextResponse.json({ ok: true, sent: 0, note: "no activity last week" });
    const lastWeek = weekStart(addDays(weekStart(now), -1));
    const marker = `results-${lastWeek}`;
    if (await store.getMeta(marker)) {
      return NextResponse.json({ ok: true, sent: 0, note: "already sent" });
    }
    await store.setMeta(marker, "1");

    const championId = recap.champion.athlete.id;
    const missedIds = new Set(recap.missed.map((s) => s.athlete.id));
    let sent = 0;
    for (const a of state.athletes) {
      let body: string;
      if (a.id === championId) {
        body = `You won last week with ${fmtPoints(recap.champion.points)} pts. Champion.`;
      } else if (missedIds.has(a.id)) {
        body = `You missed quota last week. Forfeit: ${state.settings.forfeit}. ${recap.champion.athlete.name} took the win.`;
      } else {
        body = `${recap.champion.athlete.name} won last week with ${fmtPoints(recap.champion.points)} pts. New week, fresh board.`;
      }
      await sendToAthlete(a.id, { title: "Last week's results", body, url: "/", tag: "results" });
      sent += 1;
    }
    return NextResponse.json({ ok: true, sent });
  }

  if (job === "deadline") {
    const marker = `deadline-${weekStart(now)}`;
    if (await store.getMeta(marker)) {
      return NextResponse.json({ ok: true, sent: 0, note: "already sent" });
    }
    await store.setMeta(marker, "1");

    const goal = state.settings.weeklyGoal;
    const standings = standingsFor(state.athletes, activities, state.settings, "week", now);
    let sent = 0;
    for (const s of standings) {
      if (s.points >= goal) continue;
      const togo = fmtPoints(goal - s.points);
      await sendToAthlete(s.athlete.id, {
        title: "Quota closes Sunday",
        body: `You're ${togo} pts short of ${fmtPoints(goal)}. Get a session in before the week resets.`,
        url: "/",
        tag: "deadline",
      });
      sent += 1;
    }
    return NextResponse.json({ ok: true, sent });
  }

  if (job === "midweek") {
    // One nudge per week, and only to people it actually applies to — last place,
    // or projected to miss quota at the current rate. Never nag someone who's
    // already safe, so it stays a signal, not spam.
    const marker = `midweek-${weekStart(now)}`;
    if (await store.getMeta(marker)) {
      return NextResponse.json({ ok: true, sent: 0, note: "already sent" });
    }
    await store.setMeta(marker, "1");

    const goal = state.settings.weeklyGoal;
    const standings = standingsFor(state.athletes, activities, state.settings, "week", now);
    const msPerDay = 86_400_000;
    const daysIn =
      Math.round(
        (parseDayKey(now).getTime() - parseDayKey(weekStart(now)).getTime()) / msPerDay,
      ) + 1; // Mon = 1 … Sun = 7
    const daysLeft = Math.max(0, 7 - daysIn);
    const lastRank = standings.length ? standings[standings.length - 1].rank : 0;

    let sent = 0;
    for (const s of standings) {
      if (s.points >= goal) continue; // safe — leave them be
      const togo = fmtPoints(goal - s.points);
      const projected = daysIn > 0 ? (s.points / daysIn) * 7 : 0;
      const isLast = standings.length > 1 && lastRank > 1 && s.rank === lastRank;
      const days = `${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

      let title: string;
      let body: string;
      if (isLast) {
        const ahead = standings.find((x) => x.rank < s.rank);
        title = "You're in last";
        body = ahead
          ? `Last this week — ${fmtPoints(ahead.points - s.points)} pts behind ${ahead.athlete.name}. ${togo} to quota, ${days} left.`
          : `Last this week. ${togo} pts to quota, ${days} left.`;
      } else if (projected < goal) {
        title = "Off the pace";
        body = `You're off pace for your ${fmtPoints(goal)}-pt week — ${togo} to go, ${days} left. Time to move.`;
      } else {
        continue; // on pace and not last — nothing to say
      }
      await sendToAthlete(s.athlete.id, { title, body, url: "/", tag: "midweek" });
      sent += 1;
    }
    return NextResponse.json({ ok: true, sent });
  }

  if (job === "season") {
    // Fires daily. The morning a season opens it announces it and crowns the
    // last one, once, behind a meta marker so a double-fire never
    // double-notifies.
    const cur = seasonFor(now, state.settings.seasonStart);
    if (!cur || now < state.settings.seasonStart) {
      return NextResponse.json({ ok: true, skipped: "pre-season" });
    }
    let sent = 0;
    const did: string[] = [];

    const liveMarker = `season-live-${cur.number}`;
    if (!(await store.getMeta(liveMarker))) {
      await store.setMeta(liveMarker, "1");
      let crown = "";
      if (cur.number > 1) {
        const prev = seasonByNumber(cur.number - 1, state.settings.seasonStart);
        const prevStandings = standingsForRange(state.athletes, activities, state.settings, [
          prev.start,
          prev.end,
        ]);
        const champ = prevStandings.find((s) => s.points > 0);
        if (champ) {
          crown = `${prev.label} winner: ${champ.athlete.name} (${fmtPoints(champ.points)} pts). `;
        }
      }
      for (const a of state.athletes) {
        await sendToAthlete(a.id, {
          title: `${cur.label} is live`,
          body: `${crown}Fresh board, two months on the line. ${cur.monthsLabel}.`,
          url: "/",
          tag: "season",
        });
        sent += 1;
      }
      did.push("announced");
    }

    // The run-in pushes — a heads-up in a season's last few days, then the
    // last day — went on 2026-10-06 with the rest of the run-in, at Ryan's
    // word. The opening-morning announcement above is all that's left.

    return NextResponse.json({ ok: true, sent, did });
  }

  return NextResponse.json({ error: "Unknown job" }, { status: 400 });
}
