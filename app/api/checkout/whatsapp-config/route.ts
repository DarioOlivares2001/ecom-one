import { NextResponse } from "next/server";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";

export const dynamic = "force-dynamic";

/**
 * Solo flag + teléfono para el checkout (página cliente).
 */
export async function GET() {
  const s = await getStoreSettings();
  return NextResponse.json({
    enableWhatsappCheckout: s.enable_whatsapp_checkout,
    supportWhatsapp: s.support_whatsapp ?? "",
  });
}
