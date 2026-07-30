import { getStore } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Serve an athlete's uploaded photo. The URL carries a ?v= stamp that changes on
// every upload, so it's safe to cache hard and immutable.
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const img = await getStore().getAvatarImage(id);
  if (!img) return new Response("Not found", { status: 404 });
  const bytes = Buffer.from(img.data, "base64");
  return new Response(bytes, {
    headers: {
      "Content-Type": img.contentType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
