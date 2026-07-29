import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getStore, normalizeName } from "./db";
import type { Athlete } from "./types";

const COOKIE = "amagoh_athlete";
const MAX_AGE = 60 * 60 * 24 * 365; // a season, then some

function secret(): string {
  return process.env.SESSION_SECRET || "amagoh-dev-secret";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function seal(athleteId: string): string {
  return `${athleteId}.${sign(athleteId)}`;
}

function unseal(raw: string | undefined): string | null {
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  if (i <= 0) return null;
  const id = raw.slice(0, i);
  const mac = Buffer.from(raw.slice(i + 1));
  const expected = Buffer.from(sign(id));
  if (mac.length !== expected.length) return null;
  return timingSafeEqual(mac, expected) ? id : null;
}

/**
 * Login is name-only by design: five friends, no passwords to forget. The
 * cookie carries just the athlete id — admin rights are read from the database
 * row it points at, never from anything the client can set.
 */
export async function signIn(name: string): Promise<Athlete> {
  const athlete = await getStore().findOrCreateAthlete(name);
  const jar = await cookies();
  jar.set(COOKIE, seal(athlete.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return athlete;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function currentAthlete(): Promise<Athlete | null> {
  const jar = await cookies();
  const id = unseal(jar.get(COOKIE)?.value);
  if (!id) return null;
  return getStore().getAthlete(id);
}

/** Exactly one athlete may edit the rules. Defaults to Ryan. */
export function isAdmin(athlete: Athlete | null): boolean {
  if (!athlete) return false;
  const admin = normalizeName(process.env.ADMIN_NAME || "Ryan").toLowerCase();
  return athlete.name.toLowerCase() === admin;
}
