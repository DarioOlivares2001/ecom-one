import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditProductoForm } from "./EditProductoForm";

export const metadata: Metadata = { title: "Editar producto — Admin" };

async function getProduct(id: string) {
  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("products")
      .select("*")
      .eq("id", id)
      .single();
    if (!data) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: variantRows } = await (supabase as any)
      .from("product_variants")
      .select(
        "id, title, option_values, price, compare_at_price, cost_price, stock, badge_text, active, position"
      )
      .eq("product_id", id)
      .order("position", { ascending: true });
    return { product: data, productVariants: variantRows ?? [] };
  } catch {
    return null;
  }
}

export default async function EditProductoPage({
  params,
}: {
  params: { id: string };
}) {
  const result = await getProduct(params.id);
  if (!result) notFound();
  return (
    <EditProductoForm
      product={result.product}
      productVariants={result.productVariants}
    />
  );
}
