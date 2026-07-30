import { NextResponse } from "next/server";
import { currentAthlete } from "@/lib/session";
import { getStore } from "@/lib/db";
import { readState } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Drop our stored tokens. Already-imported sessions stay; the athlete can also
// revoke access from Strava's side. Returns fresh state so the card flips back.
export async function POST() {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await getStore().deleteStrava(me.id);
  return NextResponse.json(await readState());
}
