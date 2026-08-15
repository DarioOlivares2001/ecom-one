"use server";

import { revalidatePath } from "next/cache";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import {
  createProduct,
  deleteProductHard,
  restoreProduct,
  softDeleteProduct,
  updateProduct,
} from "@/lib/db/repositories/products";
import {
  createProductVariants,
  deleteVariantsByProductId,
} from "@/lib/db/repositories/productVariants";
import { normalizeProductCategory } from "@/lib/product/categories";
import {
  parseVolumeDiscountFromFormData,
  volumeDiscountToJsonFields,
} from "@/lib/admin/productVolumeDiscounts";
import { parseProductSectionsFromFormData } from "@/lib/product/sections/parseFromFormData";
import { parseImagesFromFormData } from "@/lib/product/parseImagesFromFormData";
import { validateDropiProductUrl } from "@/lib/products/dropiLink";

export async function createProductAction(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  if (!getAdminSessionFromCookies()) {
    return { error: "No autorizado." };
  }

  const hasVariants = formData.get("has_variants") === "true";

  // ── Imágenes (ya subidas a R2 por la biblioteca de medios) ───────────────
  const imagesParsed = parseImagesFromFormData(formData);
  if (!imagesParsed.ok) return { error: imagesParsed.error };
  const images = imagesParsed.images;

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

  // Enlace manual a Dropi: opcional, pero si viene debe ser https y de un
  // dominio oficial (app.dropi.cl / app.dropi.co) — se valida en servidor y
  // nunca se guarda si no pasa la validación.
  const dropiValidation = validateDropiProductUrl(formData.get("dropi_product_url") as string | null);
  if (!dropiValidation.ok) return { error: dropiValidation.error };

  let productData: { id: string; slug: string };
  try {
    productData = await createProduct({
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
      dropi_product_url: dropiValidation.url,
      ...volumeFields,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el producto." };
  }

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

    try {
      await createProductVariants(variantInserts);
    } catch (variantError) {
      // Best-effort rollback to avoid orphan products in this flow.
      await deleteProductHard(productData.id);
      return {
        error:
          variantError instanceof Error
            ? variantError.message
            : "No se pudieron crear las variantes.",
      };
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
  if (!getAdminSessionFromCookies()) {
    return { error: "No autorizado." };
  }

  const hasVariants = formData.get("has_variants") === "true";

  // ── Imágenes (ya subidas a R2 por la biblioteca de medios) ───────────────
  const imagesParsed = parseImagesFromFormData(formData);
  if (!imagesParsed.ok) return { error: imagesParsed.error };
  const images = imagesParsed.images;

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

  // Enlace manual a Dropi: opcional, pero si viene debe ser https y de un
  // dominio oficial (app.dropi.cl / app.dropi.co) — se valida en servidor y
  // nunca se guarda si no pasa la validación.
  const dropiValidation = validateDropiProductUrl(formData.get("dropi_product_url") as string | null);
  if (!dropiValidation.ok) return { error: dropiValidation.error };

  try {
    await updateProduct(id, {
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
      dropi_product_url: dropiValidation.url,
      ...volumeFields,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el producto." };
  }

  if (hasVariants) {
    try {
      await deleteVariantsByProductId(id);
    } catch (deleteVariantsError) {
      return {
        error:
          deleteVariantsError instanceof Error
            ? deleteVariantsError.message
            : "No se pudieron reemplazar las variantes.",
      };
    }

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

    try {
      await createProductVariants(variantInserts);
    } catch (variantInsertError) {
      return {
        error:
          variantInsertError instanceof Error
            ? variantInsertError.message
            : "No se pudieron crear las variantes.",
      };
    }
  } else {
    await deleteVariantsByProductId(id);
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
  if (!getAdminSessionFromCookies()) {
    return { error: "No autorizado." };
  }
  try {
    await softDeleteProduct(id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo archivar el producto." };
  }
  revalidatePath("/admin/productos");
  return {};
}

export async function restoreProductAction(id: string): Promise<{ error?: string }> {
  if (!getAdminSessionFromCookies()) {
    return { error: "No autorizado." };
  }
  try {
    await restoreProduct(id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo restaurar el producto." };
  }
  revalidatePath("/admin/productos");
  return {};
}
