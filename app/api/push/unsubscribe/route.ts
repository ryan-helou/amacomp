import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { endpoint?: unknown };
  if (typeof body.endpoint === "string") {
    await getStore().deletePushSub(body.endpoint);
  }
  return NextResponse.json({ ok: true });
}
