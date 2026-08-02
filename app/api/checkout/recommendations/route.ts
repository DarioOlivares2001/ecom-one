import { NextResponse } from "next/server";
import { z } from "zod";
import { listUpsellEligibleProducts } from "@/lib/db/repositories";
import {
  pickCheckoutRecommendations,
  type CheckoutRecRow,
} from "@/lib/checkout/recommendations";
import { normalizeOptimizedImageUrl } from "@/lib/images/normalizeOptimizedImageUrl";

const bodySchema = z.object({
  excludeProductIds: z.array(z.string().min(1)).optional().default([]),
  cartProductNames: z.array(z.string().min(1)).optional().default([]),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ products: [] satisfies CheckoutRecRow[] });
    }
    const { excludeProductIds, cartProductNames } = parsed.data;

    let rows: CheckoutRecRow[];
    try {
      rows = await listUpsellEligibleProducts();
    } catch {
      return NextResponse.json({ products: [] });
    }
    if (!rows.length) {
      return NextResponse.json({ products: [] });
    }
    const { title, products } = pickCheckoutRecommendations(
      rows,
      excludeProductIds,
      cartProductNames,
      2
    );

    const normalizedProducts = products.map((p) => ({
      ...p,
      images: (Array.isArray(p.images) ? p.images : []).map((img) =>
        normalizeOptimizedImageUrl(String(img ?? ""))
      ),
    }));

    return NextResponse.json({ title, products: normalizedProducts });
  } catch {
    return NextResponse.json({ products: [] });
  }
}
