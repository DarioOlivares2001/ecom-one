import { NextResponse } from "next/server";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";

export const runtime = "nodejs";

export async function GET() {
  const session = getCuentaSessionFromCookies();
  return NextResponse.json({
    loggedIn: Boolean(session),
    email: session?.email ?? null,
  });
}
