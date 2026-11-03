import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "revershare_admin";

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "";
}

/** Secret URL segment, e.g. /a/<ADMIN_PATH> — not guessable like /admin */
export function adminPath(): string {
  return process.env.ADMIN_PATH?.trim() || "";
}

export function isAdminConfigured(): boolean {
  return adminPassword().length >= 6 && adminPath().length >= 12;
}

export function verifyAdminPath(slug: string): boolean {
  const expected = adminPath();
  if (!expected || expected.length < 12) return false;
  const a = Buffer.from(slug);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function sessionToken(): string {
  const password = adminPassword();
  if (!password) return "";
  const secret = process.env.ADMIN_SECRET?.trim() || password;
  return createHmac("sha256", secret).update(`revshare-admin:${password}`).digest("hex");
}

export function verifyPassword(password: string): boolean {
  const expected = adminPassword();
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifySessionToken(token: string | undefined): boolean {
  const expected = sessionToken();
  if (!token || !expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function isAdminRequest(): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  const jar = await cookies();
  return verifySessionToken(jar.get(ADMIN_COOKIE)?.value);
}
