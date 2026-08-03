import { NextResponse } from "next/server";

/**
 * Los pedidos reales y el upsert de `public.clientes` se crean en `POST /api/flow/create`
 * (checkout → Flow mock o live). Este endpoint queda como stub / futura API pública.
 */
export async function GET() {
  // Stub sin uso real; ver comentario arriba.
  return NextResponse.json({ pedidos: [] });
}

export async function POST() {
  // Stub sin uso real; ver comentario arriba.
  return NextResponse.json({ pedido: null }, { status: 201 });
}
