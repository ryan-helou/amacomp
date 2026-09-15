import { getStore } from "@/lib/db";
import { STEPS_SHORTCUT_NAME } from "@/lib/steps";

export const dynamic = "force-dynamic";

/**
 * An athlete's personal "AmaComp Steps" shortcut, their step code baked in.
 *
 * Fetched by a long random key rather than the session: the link opens in
 * Safari, which on iOS doesn't share the home-screen app's cookies, and Safari
 * is what hands a .shortcut file to the Shortcuts app. The key is only ever
 * shown to its owner, in Settings.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const file = key.length >= 20 ? await getStore().getStepShortcut(key) : null;
  if (!file) return new Response("This shortcut link has been replaced. Get a new one in AmaComp → Settings → Steps.", { status: 404 });
  return new Response(Buffer.from(file), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${STEPS_SHORTCUT_NAME}.shortcut"`,
      "Cache-Control": "private, no-store",
    },
  });
}
