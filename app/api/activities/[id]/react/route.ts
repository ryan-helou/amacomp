import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete } from "@/lib/session";
import { readState } from "@/lib/state";
import { isReaction, REACTION_LABEL } from "@/lib/types";
import { sendToAthlete } from "@/lib/push";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { type?: unknown };
  if (!isReaction(body.type)) {
    return NextResponse.json({ error: "Unknown reaction." }, { status: 400 });
  }
  const activity = await getStore().getActivity(id);
  if (!activity) return NextResponse.json({ error: "Gone." }, { status: 404 });

  await getStore().setReaction(id, me.id, body.type);

  if (activity.athleteId !== me.id) {
    void sendToAthlete(activity.athleteId, {
      title: `${me.name} reacted`,
      body: `${me.name} sent ${REACTION_LABEL[body.type]} on your session.`,
      url: "/",
      tag: `react-${id}`,
    }).catch(() => {});
  }

  return NextResponse.json(await readState());
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await getStore().removeReaction(id, me.id);
  return NextResponse.json(await readState());
}
