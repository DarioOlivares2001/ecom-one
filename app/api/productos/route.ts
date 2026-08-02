import { NextResponse } from "next/server";

export async function GET() {
  // TODO: listar productos desde Supabase
  return NextResponse.json({ productos: [] });
}

export async function POST() {
  // TODO: crear producto en Supabase
  return NextResponse.json({ producto: null }, { status: 201 });
}
