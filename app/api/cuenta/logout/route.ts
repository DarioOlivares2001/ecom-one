import { NextResponse } from "next/server";
import { clearCuentaSessionCookie } from "@/lib/cuenta/session";

export const runtime = "nodejs";

export async function POST() {
  clearCuentaSessionCookie();
  return NextResponse.json({ ok: true as const });
}
