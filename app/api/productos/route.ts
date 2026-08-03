import { NextResponse } from "next/server";

/** Stub sin uso real: no hay consumidores en el código. El catálogo público real es `/productos` (server component). */
export async function GET() {
  return NextResponse.json({ productos: [] });
}

export async function POST() {
  return NextResponse.json({ producto: null }, { status: 201 });
}
