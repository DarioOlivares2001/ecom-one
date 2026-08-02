import type { CartItem } from "@/lib/cart/store";
import { formatPrice } from "@/lib/utils/format";

/** Solo dígitos para wa.me (ej. 56912345678). Acepta +56, 56, o móvil chileno 9 dígitos. */
export function normalizeWhatsAppDigits(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;
  // Móvil CL sin código de país: 9 XXXX XXXX
  if (digits.length === 9 && digits.startsWith("9")) {
    digits = `56${digits}`;
  }
  if (digits.length < 10) return null;
  return digits;
}

export function buildWhatsAppOrderMessage(
  items: CartItem[],
  total: number
): string {
  const lines = items.map(
    (i) => `- ${i.name} x${i.quantity} - ${formatPrice(i.price * i.quantity)}`
  );
  return `Hola, quiero hacer este pedido:

🛒 Carrito:
${lines.join("\n")}

💰 Total: ${formatPrice(total)}

📍 Quiero coordinar envío / contra entrega.`;
}

/** @deprecated Usar buildWhatsAppOrderMessage */
export function buildWhatsAppCartPrefillMessage(items: CartItem[], subtotal: number): string {
  return buildWhatsAppOrderMessage(items, subtotal);
}

export function buildWhatsAppCartUrl(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}
