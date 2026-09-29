import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { keyAccepted } from "./club";

/**
 * The avatar preview pass.
 *
 * Unfinished work lives on the deployed app so Ryan can judge it on his own
 * phone, which means the league is one tap away from it. A name check doesn't
 * hold — login is name-only — so the gate is a key he has and nobody else does,
 * exchanged once for a signed cookie. Same HMAC as the session cookie: the
 * client holds a token it cannot forge, never the key itself.
 */
const COOKIE = "amagoh_preview";
const MAX_AGE = 60 * 60 * 24 * 180;
const PASS = "avatar";

function secret(): string {
  return process.env.SESSION_SECRET || "amagoh-dev-secret";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function valid(raw: string | undefined): boolean {
  if (!raw) return false;
  const i = raw.lastIndexOf(".");
  if (i <= 0) return false;
  const mac = Buffer.from(raw.slice(i + 1));
  const expected = Buffer.from(sign(raw.slice(0, i)));
  if (mac.length !== expected.length) return false;
  return timingSafeEqual(mac, expected) && raw.slice(0, i) === PASS;
}

/** Trade the key for a pass. Returns false — and sets nothing — if it's wrong. */
export async function grantAvatarPreview(key: string | null): Promise<boolean> {
  if (!keyAccepted(key, process.env.AVATAR_PREVIEW_KEY)) return false;
  const jar = await cookies();
  jar.set(COOKIE, `${PASS}.${sign(PASS)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return true;
}

export async function revokeAvatarPreview(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/**
 * Can this request see the preview? Development always can — that's where the
 * thing is built — and everywhere else needs the pass.
 */
export async function avatarPreviewGranted(): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  return valid((await cookies()).get(COOKIE)?.value);
}
