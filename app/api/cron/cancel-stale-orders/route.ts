import { NextRequest, NextResponse } from "next/server";
import { cancelStaleAwaitingPaymentOrders } from "@/lib/db/repositories/orders";

export const dynamic = "force-dynamic";

const STALE_MINUTES = 60;

/**
 * Red de seguridad servidor: cancela órdenes awaiting_payment abandonadas
 * (Flow no siempre notifica cancelaciones voluntarias del usuario). Protegido
 * con CRON_SECRET para que no sea invocable públicamente.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
    const cancelled = await cancelStaleAwaitingPaymentOrders(cutoff);

    console.log(`[cron/cancel-stale] ${cancelled.length} órdenes zombie canceladas`, {
      cancelled,
    });
    return NextResponse.json({ ok: true, cancelled: cancelled.length, orderNumbers: cancelled });
  } catch (err) {
    console.error("[cron/cancel-stale] excepción:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
