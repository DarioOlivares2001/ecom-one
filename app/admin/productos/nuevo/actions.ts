"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeProductCategory } from "@/lib/product/categories";
import {
  parseVolumeDiscountFromFormData,
  volumeDiscountToJsonFields,
} from "@/lib/admin/productVolumeDiscounts";
import { parseProductSectionsFromFormData } from "@/lib/product/sections/parseFromFormData";

export async function createProductAction(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = createAdminClient();
  const hasVariants = formData.get("has_variants") === "true";

  // ── Upload multiple images in order ───────────────────────
  const count = Number(formData.get("image_count") ?? "0");
  const images: string[] = [];

  for (let i = 0; i < count; i++) {
    const file = formData.get(`image_${i}`) as File | null;
    if (!file || file.size === 0) continue;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const fileName = `${Date.now()}-${i}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("products")
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      return { error: `Error subiendo imagen ${i + 1}: ${uploadError.message}` };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("products").getPublicUrl(uploadData.path);

    images.push(publicUrl);
  }

  // ── Parse variants ────────────────────────────────────────
  const variantsRaw = formData.get("variants") as string;
  let variants: Record<string, string[]> | null = null;
  try {
    const parsed = JSON.parse(variantsRaw || "[]") as Array<{
      name: string;
      values: string;
    }>;
    const obj: Record<string, string[]> = {};
    for (const { name, values } of parsed) {
      if (name.trim() && values.trim()) {
        obj[name.trim()] = values
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      }
    }
    variants = Object.keys(obj).length > 0 ? obj : null;
  } catch {
    // invalid JSON — skip variants
  }

  // ── Insert product ────────────────────────────────────────
  const compareAtRaw = formData.get("compare_at_price") as string;
  const compareAt = compareAtRaw ? Number(compareAtRaw) : null;
  const costPriceRaw = formData.get("cost_price") as string;
  const costPrice = costPriceRaw ? Number(costPriceRaw) : null;
  const optionsRaw = formData.get("options_json") as string | null;
  const variantRowsRaw = formData.get("variant_rows_json") as string | null;

  let options: Array<{ name: string; values: string[] }> | null = null;
  let variantRows: Array<{
    title: string;
    option_values: Record<string, string>;
    price: number;
    compare_at_price: number | null;
    cost_price: number | null;
    stock: number;
    image_url: string | null;
    badge_text: string | null;
    active: boolean;
    position: number;
  }> = [];

  if (hasVariants) {
    try {
      const parsedOptions = JSON.parse(optionsRaw || "null") as
        | Array<{ name: string; values: string[] }>
        | null;
      options = parsedOptions?.length ? parsedOptions : null;
    } catch {
      options = null;
    }

    try {
      const parsedRows = JSON.parse(variantRowsRaw || "[]") as Array<{
        title: string;
        option_values: Record<string, string>;
        price: number;
        compare_at_price: number | null;
        cost_price: number | null;
        stock: number;
        image_url: string | null;
        badge_text: string | null;
        active: boolean;
        position: number;
      }>;
      variantRows = parsedRows.filter(
        (row) => row.title?.trim() && row.price >= 0 && row.stock >= 0
      );
    } catch {
      variantRows = [];
    }

    if (!options?.length) {
      return { error: "Debes definir al menos una opción de variante." };
    }
    if (!variantRows.length) {
      return { error: "Debes agregar al menos una variante válida." };
    }
  }

  let basePrice = Number(formData.get("price"));
  let baseCompareAt = compareAt && compareAt > 0 ? compareAt : null;
  let baseStock = Number(formData.get("stock") ?? 0);

  if (hasVariants) {
    const firstActiveWithPrice = variantRows.find(
      (row) => row.active && row.price > 0
    );
    if (!firstActiveWithPrice) {
      return { error: "Ingresa al menos una variante activa con precio válido" };
    }
    basePrice = Number(firstActiveWithPrice.price);
    baseCompareAt =
      firstActiveWithPrice.compare_at_price &&
      firstActiveWithPrice.compare_at_price > 0
        ? firstActiveWithPrice.compare_at_price
        : null;
    baseStock = Number(firstActiveWithPrice.stock ?? 0);
  } else if (!basePrice || basePrice <= 0) {
    return { error: "Ingresa un precio válido." };
  }

  const normalizedCategory = normalizeProductCategory(formData.get("category") as string);

  const volumeParsed = parseVolumeDiscountFromFormData(formData);
  if (!volumeParsed.ok) return { error: volumeParsed.error };
  const volumeFields = volumeDiscountToJsonFields(volumeParsed.data);

  // Bloques modulares (Fase 2B): se mandan como JSON string en `product_sections_json`.
  // Si el campo no viene, se interpreta como [] (fallback a description HTML).
  const sectionsParsed = parseProductSectionsFromFormData(formData);
  if (!sectionsParsed.ok) return { error: sectionsParsed.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: productData, error } = await (supabase as any)
    .from("products")
    .insert({
    name: (formData.get("name") as string).trim(),
    slug: (formData.get("slug") as string).trim(),
    description: (formData.get("description") as string) || null,
    price: basePrice,
    compare_at_price: baseCompareAt,
    cost_price: hasVariants ? null : costPrice,
    stock: baseStock,
    category: normalizedCategory || null,
    images,
    variants: hasVariants ? null : variants,
    has_variants: hasVariants,
    options: hasVariants ? options : null,
    active: formData.get("active") === "true",
    product_sections: sectionsParsed.data,
    ...volumeFields,
  })
    .select("id, slug")
    .single();

  if (error) return { error: error.message };

  if (hasVariants) {
    const variantInserts = variantRows.map((row) => ({
      product_id: productData.id,
      title: row.title.trim(),
      option_values: row.option_values,
      price: Number(row.price),
      compare_at_price: row.compare_at_price && row.compare_at_price > 0 ? row.compare_at_price : null,
      cost_price: row.cost_price && row.cost_price > 0 ? row.cost_price : null,
      stock: Number(row.stock),
      image_url: row.image_url || null,
      badge_text: row.badge_text || null,
      active: row.active,
      position: Number(row.position ?? 0),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: variantError } = await (supabase as any)
      .from("product_variants")
      .insert(variantInserts);

    if (variantError) {
      // Best-effort rollback to avoid orphan products in this flow.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("products").delete().eq("id", productData.id);
      return { error: variantError.message };
    }
  }

  revalidatePath("/admin/productos");
  const createdSlug =
    typeof productData?.slug === "string" ? productData.slug.trim() : "";
  if (createdSlug) {
    revalidatePath(`/productos/${createdSlug}`);
  }
  return { success: true };
}

export async function updateProductAction(
  id: string,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = createAdminClient();
  const hasVariants = formData.get("has_variants") === "true";

  // ── Process ordered image slots ───────────────────────────
  const slotCount = Number(formData.get("slot_count") ?? "0");
  const images: string[] = [];

  for (let i = 0; i < slotCount; i++) {
    const type = formData.get(`slot_${i}_type`) as string;
    if (type === "existing") {
      const url = formData.get(`slot_${i}_url`) as string;
      if (url) images.push(url);
    } else if (type === "new") {
      const file = formData.get(`slot_${i}_file`) as File | null;
      if (!file || file.size === 0) continue;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const fileName = `${Date.now()}-${i}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("products")
        .upload(fileName, file, { contentType: file.type, upsert: false });
      if (uploadError) return { error: `Error subiendo imagen: ${uploadError.message}` };
      const {
        data: { publicUrl },
      } = supabase.storage.from("products").getPublicUrl(uploadData.path);
      images.push(publicUrl);
    }
  }

  // ── Parse variants ────────────────────────────────────────
  const variantsRaw = formData.get("variants") as string;
  let variants: Record<string, string[]> | null = null;
  try {
    const parsed = JSON.parse(variantsRaw || "[]") as Array<{
      name: string;
      values: string;
    }>;
    const obj: Record<string, string[]> = {};
    for (const { name, values } of parsed) {
      if (name.trim() && values.trim()) {
        obj[name.trim()] = values
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      }
    }
    variants = Object.keys(obj).length > 0 ? obj : null;
  } catch {
    // invalid JSON — skip variants
  }

  // ── Update product ────────────────────────────────────────
  const compareAtRaw = formData.get("compare_at_price") as string;
  const compareAt = compareAtRaw ? Number(compareAtRaw) : null;
  const costPriceRaw = formData.get("cost_price") as string;
  const costPrice = costPriceRaw ? Number(costPriceRaw) : null;
  const optionsRaw = formData.get("options_json") as string | null;
  const variantRowsRaw = formData.get("variant_rows_json") as string | null;

  let options: Array<{ name: string; values: string[] }> | null = null;
  let variantRows: Array<{
    title: string;
    option_values: Record<string, string>;
    price: number;
    compare_at_price: number | null;
    cost_price: number | null;
    stock: number;
    image_url: string | null;
    badge_text: string | null;
    active: boolean;
    position: number;
  }> = [];

  if (hasVariants) {
    try {
      const parsedOptions = JSON.parse(optionsRaw || "null") as
        | Array<{ name: string; values: string[] }>
        | null;
      options = parsedOptions?.length ? parsedOptions : null;
    } catch {
      options = null;
    }

    try {
      const parsedRows = JSON.parse(variantRowsRaw || "[]") as Array<{
        title: string;
        option_values: Record<string, string>;
        price: number;
        compare_at_price: number | null;
        cost_price: number | null;
        stock: number;
        image_url: string | null;
        badge_text: string | null;
        active: boolean;
        position: number;
      }>;
      variantRows = parsedRows.filter(
        (row) => row.title?.trim() && row.price >= 0 && row.stock >= 0
      );
    } catch {
      variantRows = [];
    }

    if (!options?.length) {
      return { error: "Debes definir al menos una opción de variante." };
    }
    if (!variantRows.length) {
      return { error: "Debes agregar al menos una variante válida." };
    }
  }

  let basePrice = Number(formData.get("price"));
  let baseCompareAt = compareAt && compareAt > 0 ? compareAt : null;
  let baseStock = Number(formData.get("stock") ?? 0);

  if (hasVariants) {
    const firstActiveWithPrice = variantRows.find(
      (row) => row.active && row.price > 0
    );
    if (!firstActiveWithPrice) {
      return { error: "Ingresa al menos una variante activa con precio válido" };
    }
    basePrice = Number(firstActiveWithPrice.price);
    baseCompareAt =
      firstActiveWithPrice.compare_at_price &&
      firstActiveWithPrice.compare_at_price > 0
        ? firstActiveWithPrice.compare_at_price
        : null;
    baseStock = Number(firstActiveWithPrice.stock ?? 0);
  } else if (!basePrice || basePrice <= 0) {
    return { error: "Ingresa un precio válido." };
  }

  const normalizedCategory = normalizeProductCategory(formData.get("category") as string);

  const volumeParsed = parseVolumeDiscountFromFormData(formData);
  if (!volumeParsed.ok) return { error: volumeParsed.error };
  const volumeFields = volumeDiscountToJsonFields(volumeParsed.data);

  // Bloques modulares (Fase 2A): se mandan como JSON string en `product_sections_json`.
  // Si el campo no viene, se interpreta como [] (sin tocar).
  const sectionsParsed = parseProductSectionsFromFormData(formData);
  if (!sectionsParsed.ok) return { error: sectionsParsed.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("products").update({
    name: (formData.get("name") as string).trim(),
    slug: (formData.get("slug") as string).trim(),
    description: (formData.get("description") as string) || null,
    price: basePrice,
    compare_at_price: baseCompareAt,
    cost_price: hasVariants ? null : costPrice,
    stock: baseStock,
    category: normalizedCategory || null,
    images,
    variants: hasVariants ? null : variants,
    has_variants: hasVariants,
    options: hasVariants ? options : null,
    active: formData.get("active") === "true",
    product_sections: sectionsParsed.data,
    ...volumeFields,
  }).eq("id", id);

  if (error) return { error: error.message };

  if (hasVariants) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteVariantsError } = await (supabase as any)
      .from("product_variants")
      .delete()
      .eq("product_id", id);
    if (deleteVariantsError) return { error: deleteVariantsError.message };

    const variantInserts = variantRows.map((row) => ({
      product_id: id,
      title: row.title.trim(),
      option_values: row.option_values,
      price: Number(row.price),
      compare_at_price:
        row.compare_at_price && row.compare_at_price > 0 ? row.compare_at_price : null,
      cost_price: row.cost_price && row.cost_price > 0 ? row.cost_price : null,
      stock: Number(row.stock),
      image_url: row.image_url || null,
      badge_text: row.badge_text || null,
      active: row.active,
      position: Number(row.position ?? 0),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: variantInsertError } = await (supabase as any)
      .from("product_variants")
      .insert(variantInserts);
    if (variantInsertError) return { error: variantInsertError.message };
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("product_variants").delete().eq("product_id", id);
  }

  revalidatePath("/admin/productos");
  revalidatePath(`/admin/productos/${id}`);
  const updatedSlug = (formData.get("slug") as string | null)?.trim();
  if (updatedSlug) {
    revalidatePath(`/productos/${updatedSlug}`);
  }
  return { success: true };
}

export async function archiveProductAction(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("products")
    .update({ active: false, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/productos");
  return {};
}

export async function restoreProductAction(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("products")
    .update({ active: true, deleted_at: null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/productos");
  return {};
}
