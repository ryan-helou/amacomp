import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { readState } from "@/lib/state";
import { notifyOvertakes, pushEnabled, sendToAthlete } from "@/lib/push";
import { standingsFor, fmtPoints } from "@/lib/scoring";
import { addDays, parseDayKey, today, weekStart } from "@/lib/dates";
import { lastWeekRecap } from "@/lib/achievements";
import { stravaConfigured, syncAthlete } from "@/lib/strava";

export const dynamic = "force-dynamic";

/**
 * Scheduled work, triggered by an external cron (GitHub Actions) hitting this
 * endpoint with the shared secret. The notify jobs are idempotent per week via
 * the `meta` store, so a double-fire never double-notifies.
 *   ?job=strava   — every 30 min: pull each linked athlete's new activities
 *   ?job=midweek  — Thursday: nudge whoever's last or off the quota pace
 *   ?job=results  — Monday: last week's champion + forfeit list
 *   ?job=deadline — Sunday: who still hasn't hit quota
 */
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
  if (job === "strava") {
    if (!stravaConfigured()) {
      return NextResponse.json({ ok: true, skipped: "strava not configured" });
    }
    const conns = await store.listStravaConns();
    let athletes = 0;
    const importedBy = new Map<string, string[]>();
    for (const conn of conns) {
      try {
        const created = await syncAthlete(store, conn, 3);
        if (created.length) importedBy.set(conn.athleteId, created);
        athletes += 1;
      } catch {
        // One dead connection (revoked, rate-limited) shouldn't stop the rest.
      }
    }

    // Most sessions arrive here rather than through the log form, so this is
    // where the "you just got passed" nudge actually earns its keep. Read state
    // once, after every athlete has synced, so the standings reflect the full tick.
    let imported = 0;
    if (importedBy.size > 0) {
      const state = await readState();
      for (const [athleteId, ids] of importedBy) {
        imported += ids.length;
        await notifyOvertakes(
          athleteId,
          state.athletes,
          state.activities,
          ids,
          state.settings,
        ).catch(() => {});
      }
    }
    return NextResponse.json({ ok: true, athletes, imported });
  }

  if (!pushEnabled()) {
    return NextResponse.json({ ok: true, skipped: "push not configured" });
  }

  const state = await readState();
  const now = today();
  const activities = state.activities;

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

  return NextResponse.json({ error: "Unknown job" }, { status: 400 });
}
