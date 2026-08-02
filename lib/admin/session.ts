import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "admin_session";
const TTL_SECONDS = 60 * 60 * 12; // 12 horas

export type AdminSessionPayload = {
  id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
};

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function getAdminSessionSecret(): string {
  const secret =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  if (!secret) throw new Error("Falta ADMIN_SESSION_SECRET para sesión admin.");
  return secret;
}

function signRaw(rawPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(rawPayload).digest("base64url");
}

export function createAdminSessionToken(input: { id: string; email: string; role: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    id: input.id,
    email: input.email.trim().toLowerCase(),
    role: input.role || "admin",
    iat: now,
    exp: now + TTL_SECONDS,
  };
  const rawPayload = base64UrlEncode(JSON.stringify(payload));
  const sig = signRaw(rawPayload, getAdminSessionSecret());
  return `${rawPayload}.${sig}`;
}

export function verifyAdminSessionToken(token: string): AdminSessionPayload | null {
  try {
    const [rawPayload, sig] = token.split(".");
    if (!rawPayload || !sig) return null;
    const expected = signRaw(rawPayload, getAdminSessionSecret());
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = JSON.parse(base64UrlDecode(rawPayload)) as AdminSessionPayload;
    if (!payload?.id || !payload?.email || !payload?.role) return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setAdminSessionCookie(input: { id: string; email: string; role: string }): void {
  const token = createAdminSessionToken(input);
  cookies().set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export function clearAdminSessionCookie(): void {
  cookies().set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function getAdminSessionFromCookies(): AdminSessionPayload | null {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

