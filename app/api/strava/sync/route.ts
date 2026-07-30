import { NextResponse } from "next/server";
import { currentAthlete } from "@/lib/session";
import { getStore } from "@/lib/db";
import { readState } from "@/lib/state";
import { syncAthlete } from "@/lib/strava";
import { notifyOvertakes } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual "Sync now" — pull the last three weeks and import anything new. Returns
// the fresh app state so the board updates in place.
export async function POST() {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const store = getStore();
  const conn = await store.getStravaByAthlete(me.id);
  if (!conn) return NextResponse.json({ error: "Strava isn't connected." }, { status: 400 });
  try {
    const created = await syncAthlete(store, conn, 21);
    const state = await readState();
    void notifyOvertakes(
      me.id,
      state.athletes,
      state.activities,
      created,
      state.settings,
    ).catch(() => {});
    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ error: "Sync failed. Try again in a minute." }, { status: 502 });
  }
}
