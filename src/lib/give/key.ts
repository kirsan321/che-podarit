import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

export const GIVER_COOKIE = "giver_key";
const ONE_YEAR = 60 * 60 * 24 * 365;
const KEY_RE = /^[0-9a-f]{32}$/;

/** Read the anonymous giver id from the cookie (Server Components, actions). Null if absent or malformed. */
export async function getGiverKey(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(GIVER_COOKIE)?.value ?? "";
  return KEY_RE.test(v) ? v : null;
}

/**
 * Return the giver id, creating the cookie when missing.
 * Only callable where cookies are writable (Server Functions / Route Handlers).
 */
export async function ensureGiverKey(): Promise<string> {
  const existing = await getGiverKey();
  if (existing) return existing;
  const key = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(GIVER_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return key;
}
