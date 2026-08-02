import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const CUENTA_SESSION_COOKIE = "tg_cuenta_session";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días

type SessionPayload = {
  email: string;
  iat: number;
  exp: number;
};

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function getSessionSecret(): string {
  const secret =
    process.env.CUENTA_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  if (!secret) throw new Error("Falta CUENTA_SESSION_SECRET para sesión de cuenta.");
  return secret;
}

function signRaw(rawPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(rawPayload).digest("base64url");
}

export function createCuentaSessionToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    email,
    iat: now,
    exp: now + TTL_SECONDS,
  };
  const rawPayload = base64UrlEncode(JSON.stringify(payload));
  const sig = signRaw(rawPayload, getSessionSecret());
  return `${rawPayload}.${sig}`;
}

export function verifyCuentaSessionToken(token: string): SessionPayload | null {
  try {
    const [rawPayload, sig] = token.split(".");
    if (!rawPayload || !sig) return null;

    const expected = signRaw(rawPayload, getSessionSecret());
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = JSON.parse(base64UrlDecode(rawPayload)) as SessionPayload;
    if (!payload?.email || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setCuentaSessionCookie(email: string): void {
  const token = createCuentaSessionToken(email);
  cookies().set(CUENTA_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export function clearCuentaSessionCookie(): void {
  cookies().set(CUENTA_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function getCuentaSessionFromCookies():
  | {
      email: string;
    }
  | null {
  const token = cookies().get(CUENTA_SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyCuentaSessionToken(token);
  if (!payload) return null;
  return { email: payload.email };
}
