import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete } from "@/lib/session";
import { readState } from "@/lib/state";
import { MAX_COMMENT } from "@/lib/types";
import { sendToAthlete } from "@/lib/push";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { body?: unknown };
  const text = typeof body.body === "string" ? body.body.trim().slice(0, MAX_COMMENT) : "";
  if (!text) return NextResponse.json({ error: "Say something." }, { status: 400 });

  const activity = await getStore().getActivity(id);
  if (!activity) return NextResponse.json({ error: "Gone." }, { status: 404 });

  await getStore().addComment(id, me.id, text);

  if (activity.athleteId !== me.id) {
    void sendToAthlete(activity.athleteId, {
      title: `${me.name} commented`,
      body: text.slice(0, 120),
      url: "/",
      tag: `comment-${id}`,
    }).catch(() => {});
  }

  return NextResponse.json(await readState());
}
