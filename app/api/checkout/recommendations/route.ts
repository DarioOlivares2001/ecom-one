import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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

    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, slug, name, price, cost_price, compare_at_price, images, stock, category, tags, has_variants, discount_enabled, discount_max_percent, discount_steps"
      )
      .eq("active", true)
      .gt("stock", 0)
      .eq("has_variants", false);

    if (error || !data?.length) {
      return NextResponse.json({ products: [] });
    }

    const rows = data as CheckoutRecRow[];
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
