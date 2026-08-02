import type { CartItem } from "@/lib/cart/store";
import type { Product } from "@/lib/supabase/types";
import { toPixelContentId } from "@/lib/pixel/contentId";
import { sumProductsValue, type PixelLineItem } from "@/lib/pixel/productsValue";

declare global {
  function fbq(
    event: "track",
    name: string,
    params?: Record<string, unknown>,
    options?: { eventID?: string }
  ): void;
}

const CURRENCY = "CLP";

export const pixelEvents = {
  pageView() {
    if (typeof fbq === "undefined") return;
    fbq("track", "PageView");
  },

  viewContent(product: Product) {
    if (typeof fbq === "undefined") return;
    fbq("track", "ViewContent", {
      content_ids: [toPixelContentId(product.id)],
      content_type: "product",
      content_name: product.name,
      value: sumProductsValue([{ price: product.price, quantity: 1 }]),
      currency: CURRENCY,
    });
  },

  addToCart(product: Product, quantity: number) {
    if (typeof fbq === "undefined") return;
    fbq("track", "AddToCart", {
      content_ids: [toPixelContentId(product.id)],
      content_type: "product",
      content_name: product.name,
      value: sumProductsValue([{ price: product.price, quantity }]),
      currency: CURRENCY,
    });
  },

  initiateCheckout(cart: CartItem[]) {
    if (typeof fbq === "undefined") return;
    fbq("track", "InitiateCheckout", {
      content_ids: cart.map((i) => toPixelContentId(i.product_id)),
      content_type: "product",
      num_items: cart.reduce((acc, i) => acc + i.quantity, 0),
      // Solo valor de productos (sin envío) — mismo criterio que Purchase.
      value: sumProductsValue(cart),
      currency: CURRENCY,
    });
  },

  /**
   * Purchase del NAVEGADOR — complementario al de servidor (lib/pixel/capi.ts,
   * que es la fuente de verdad y no depende de que el cliente llegue acá).
   * Usa el mismo `eventId` (display_code de la orden) que el servidor para
   * que Meta deduplique Pixel + CAPI como un solo evento.
   *
   * `items` son los ítems reales de la orden pagada; el value se calcula acá
   * mismo con `sumProductsValue` — igual que InitiateCheckout, sin envío.
   */
  purchase(params: { items: PixelLineItem[]; contentIds: string[]; orderId: string; eventId: string }) {
    if (typeof fbq === "undefined") return;
    fbq(
      "track",
      "Purchase",
      {
        content_ids: params.contentIds.map(toPixelContentId),
        content_type: "product",
        value: sumProductsValue(params.items),
        currency: CURRENCY,
        order_id: params.orderId,
      },
      { eventID: params.eventId }
    );
  },
};
