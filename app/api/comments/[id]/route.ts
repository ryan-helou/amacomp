import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete, isAdmin } from "@/lib/session";
import { readState } from "@/lib/state";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const comment = await getStore().getComment(id);
  if (!comment) return NextResponse.json({ error: "Already gone." }, { status: 404 });
  if (comment.athleteId !== me.id && !isAdmin(me)) {
    return NextResponse.json({ error: "Not yours to delete." }, { status: 403 });
  }

  await getStore().deleteComment(id);
  return NextResponse.json(await readState());
}
