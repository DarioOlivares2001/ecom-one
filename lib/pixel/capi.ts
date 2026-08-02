import crypto from "crypto";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { normalizeWhatsAppDigits } from "@/lib/cart/whatsappCartOrder";
import { toPixelContentId } from "@/lib/pixel/contentId";
import { sumProductsValue, type PixelLineItem } from "@/lib/pixel/productsValue";

/**
 * SOLO SERVIDOR. Nunca importar desde un archivo "use client" — usa
 * meta_capi_access_token (secreto) leído de store_settings.
 */

const GRAPH_API_VERSION = "v21.0";
const CURRENCY = "CLP";

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Normalización de Meta: lowercase + trim antes de hashear. */
function hashEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  return sha256Hex(normalized);
}

/** Normalización de Meta: solo dígitos + código de país, sin "+". Reusa el normalizador de WhatsApp. */
function hashPhone(phone: string | null | undefined): string | null {
  const digits = normalizeWhatsAppDigits(phone);
  if (!digits) return null;
  return sha256Hex(digits);
}

export type MetaPurchaseInput = {
  /** display_code de la orden (SO01007XXX) — mismo event_id que el Purchase del navegador, para deduplicar. */
  eventId: string;
  orderId: string;
  contentIds: string[];
  /** Ítems reales de la orden — el value se calcula acá con sumProductsValue (sin envío), igual que el resto de los eventos. */
  items: PixelLineItem[];
  eventSourceUrl: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

/**
 * Envía un evento Purchase a Meta Conversions API.
 * Nunca lanza: cualquier fallo se loguea y devuelve `{ ok: false }`. Un error
 * acá jamás debe romper el flujo que lo llama (webhook de Flow / creación de orden).
 */
export async function sendMetaCapiPurchase(
  input: MetaPurchaseInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const settings = await getStoreSettings();
    if (!settings.meta_pixel_enabled) return { ok: true };

    const pixelId = settings.meta_pixel_id.trim();
    const accessToken = settings.meta_capi_access_token.trim();
    if (!pixelId || !accessToken) {
      console.warn("[meta-capi] meta_pixel_enabled=true pero falta meta_pixel_id o meta_capi_access_token.");
      return { ok: false, error: "Pixel habilitado sin credenciales completas" };
    }

    const userData: Record<string, unknown> = {};
    const hashedEmail = hashEmail(input.customerEmail);
    if (hashedEmail) userData.em = [hashedEmail];
    const hashedPhone = hashPhone(input.customerPhone);
    if (hashedPhone) userData.ph = [hashedPhone];
    if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
    if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;

    const testEventCode = settings.meta_test_event_code.trim();

    const body: Record<string, unknown> = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: input.eventId,
          action_source: "website",
          event_source_url: input.eventSourceUrl,
          user_data: userData,
          custom_data: {
            content_ids: input.contentIds.map(toPixelContentId),
            content_type: "product",
            currency: CURRENCY,
            value: sumProductsValue(input.items),
            order_id: input.orderId,
          },
        },
      ],
      ...(testEventCode ? { test_event_code: testEventCode } : {}),
    };

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[meta-capi] Meta respondió error al enviar Purchase", {
        status: res.status,
        error: data?.error,
      });
      return {
        ok: false,
        error: typeof data?.error?.message === "string" ? data.error.message : `HTTP ${res.status}`,
      };
    }

    console.log("[meta-capi] Purchase enviado", {
      eventId: input.eventId,
      orderId: input.orderId,
      testMode: Boolean(testEventCode),
      eventsReceived: data?.events_received,
    });
    return { ok: true };
  } catch (err) {
    console.error("[meta-capi] excepción enviando Purchase", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
