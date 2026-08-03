import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductById, listVariantsByProductId } from "@/lib/db/repositories";
import { EditProductoForm } from "./EditProductoForm";

export const metadata: Metadata = { title: "Editar producto — Admin" };

async function getProduct(id: string) {
  try {
    const product = await getProductById(id);
    if (!product) return null;
    const productVariants = await listVariantsByProductId(id);
    return { product, productVariants };
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
    // `variants`/`options`/`option_values` son JSON dinámico (Json en el schema);
    // EditProductoForm ya los trata como tal internamente con casts puntuales.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    <EditProductoForm
      product={result.product as any}
      productVariants={result.productVariants as any}
    />
    /* eslint-enable @typescript-eslint/no-explicit-any */
  );
}
