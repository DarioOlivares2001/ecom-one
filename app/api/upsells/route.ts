import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  FALLBACK_RECOMMENDATION_TITLE,
  pickCheckoutRecommendations,
  type CheckoutRecRow,
} from "@/lib/checkout/recommendations";
import { normalizeOptimizedImageUrl } from "@/lib/images/normalizeOptimizedImageUrl";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      cartProductIds?: string[];
      cartProductNames?: string[];
    };
    const cartProductIds = Array.isArray(body.cartProductIds)
      ? body.cartProductIds.filter(Boolean)
      : [];
    const cartProductNames = Array.isArray(body.cartProductNames)
      ? body.cartProductNames.filter(Boolean)
      : [];

    const supabase = createClient();
    // Filtro server-side: SOLO productos elegibles para upsell.
    // - active = true
    // - stock > 0
    // - sin variantes (no se pueden agregar como 1 sola unidad sin elegir variante)
    // - discount_enabled = true
    // - discount_max_percent > 0
    // compare_at_price NO se usa para generar ofertas de upsell.
    const { data, error } = await supabase
      .from("products")
      .select(
        "id,slug,name,price,compare_at_price,cost_price,stock,images,active,has_variants,category,tags,discount_enabled,discount_max_percent,discount_steps"
      )
      .eq("active", true)
      .gt("stock", 0)
      .eq("has_variants", false)
      .eq("discount_enabled", true)
      .gt("discount_max_percent", 0)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[upsells candidates] error en query", { error: error.message });
      }
      return NextResponse.json({ offers: [] }, { status: 200 });
    }

    const rows = (data ?? []) as CheckoutRecRow[];
    const totalCandidates = rows.length;
    // Excluir productos ya en el carrito (regla del usuario).
    const inCart = new Set(cartProductIds);
    const eligibleRows = rows.filter((r) => !inCart.has(r.id));
    const filteredByDiscount = eligibleRows.length;

    const { title, products } = pickCheckoutRecommendations(
      eligibleRows,
      cartProductIds,
      cartProductNames,
      2
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    const offers = products
      .map((p) => {
        const base = byId.get(p.id);
        const list = base?.price ?? p.price;
        const cap = Math.min(
          100,
          Math.max(0, Number(base?.discount_max_percent) || 0)
        );
        const rawPct =
          typeof p.discountPercent === "number" && p.discountPercent > 0
            ? Math.round(p.discountPercent)
            : 0;
        // El % visible nunca supera el tope `discount_max_percent`.
        const discountPercent = Math.min(rawPct, cap);
        // Si por cualquier motivo se cae el descuento (cap=0, sin step), no es oferta.
        if (
          base?.discount_enabled !== true ||
          cap <= 0 ||
          discountPercent <= 0
        ) {
          return null;
        }
        const offerPrice = Math.round(list * (1 - discountPercent / 100));
        if (!(offerPrice > 0) || offerPrice >= list) return null;
        const savings = Math.max(0, list - offerPrice);
        return {
          id: p.id,
          name: p.name,
          image: normalizeOptimizedImageUrl(p.images?.[0] ?? ""),
          price: list,
          compare_at_price: base?.compare_at_price ?? p.compare_at_price ?? null,
          offerPrice,
          discountPercent,
          savings,
          stock: base?.stock ?? 0,
          discount_enabled: true,
          discount_max_percent: cap,
          discount_steps: Array.isArray(base?.discount_steps)
            ? base?.discount_steps
            : [],
        };
      })
      .filter((o): o is NonNullable<typeof o> => o !== null);

    if (process.env.NODE_ENV === "development") {
      console.log("[upsells candidates]", {
        cartProductIds,
        totalCandidates,
        filteredByDiscount,
        returned: offers.length,
        offerIds: offers.map((o) => ({
          id: o.id,
          name: o.name,
          discountPercent: o.discountPercent,
          offerPrice: o.offerPrice,
          listPrice: o.price,
        })),
      });
    }

    return NextResponse.json(
      { title: title || FALLBACK_RECOMMENDATION_TITLE, offers },
      { status: 200 }
    );
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[upsells candidates] excepción", e);
    }
    return NextResponse.json({ offers: [] }, { status: 200 });
  }
}
