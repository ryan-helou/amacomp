import { createHash, randomBytes } from "node:crypto";

/**
 * The code that lets one athlete's Shortcut post their steps.
 *
 * Only a hash is stored: the plain code is shown once, handed to the Shortcut,
 * and never kept. All it can do is write that athlete's own daily step totals,
 * so a leaked one is low stakes — and generating a new one replaces it.
 */
export function newStepToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashStepToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

/** `Authorization: Bearer <code>`, or a `token` field in the body. */
export function stepTokenFrom(req: Request, body: unknown): string | null {
  const header = req.headers.get("authorization");
  const m = header?.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const t = (body as Record<string, unknown>).token;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return null;
}
