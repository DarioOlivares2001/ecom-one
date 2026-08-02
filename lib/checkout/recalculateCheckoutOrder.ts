import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  getApplicableProductDiscount,
  getDiscountedUnitPrice,
  type ProductDiscountInput,
} from "@/lib/discounts";
import { normalizeOptimizedImageUrl } from "@/lib/images/normalizeOptimizedImageUrl";
import { computeShippingCostClp } from "@/lib/checkout/shipping";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";

type ProductRow = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  | "id"
  | "name"
  | "price"
  | "stock"
  | "has_variants"
  | "images"
  | "discount_enabled"
  | "discount_max_percent"
  | "discount_steps"
  | "discount_label"
  | "active"
>;

type VariantRow = Pick<
  Database["public"]["Tables"]["product_variants"]["Row"],
  "id" | "product_id" | "title" | "price" | "stock" | "active" | "image_url"
>;

export type OrderLineDiscountSource = "upsell" | "quantity";

export type RecalculatedOrderLine = {
  product_id: string;
  name: string;
  /** Precio unitario cobrado (= unit_price). Compat plantillas/email. */
  price: number;
  quantity: number;
  image: string;
  variant?: string;
  variant_id?: string;
  original_unit_price: number;
  discount_percent: number;
  unit_price: number;
  line_total: number;
  discount_source: OrderLineDiscountSource;
};

export type RecalculateCheckoutOrderResult =
  | {
      ok: true;
      items: RecalculatedOrderLine[];
      subtotal: number;
      shippingCost: number;
      total: number;
    }
  | { ok: false; error: string; status: number };

type ParsedLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
  clientImage?: string;
  checkoutSource?: "upsell";
  applied_discount_percent?: number;
  expected_unit_price?: number;
};

function parseQuantity(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || Number.isNaN(n) || n < 1) return null;
  const q = Math.floor(n);
  return q < 1 ? null : q;
}

function parseIncomingLines(rawItems: unknown): ParsedLine[] | null {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return null;
  const out: ParsedLine[] = [];
  for (const row of rawItems) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const productId = String(r.product_id ?? r.id ?? "").trim();
    if (!productId) continue;
    const qty = parseQuantity(r.quantity);
    if (qty === null) {
      return null;
    }
    const vidRaw = r.variant_id ?? r.variantId;
    const variantId =
      typeof vidRaw === "string" && vidRaw.trim()
        ? vidRaw.trim()
        : typeof vidRaw === "number" && Number.isFinite(vidRaw)
          ? String(vidRaw)
          : null;
    const clientImage = typeof r.image === "string" ? r.image : undefined;
    const srcRaw = r.source;
    const checkoutSource =
      srcRaw === "upsell" || r.isUpsellOffer === true ? ("upsell" as const) : undefined;
    const appliedRaw =
      checkoutSource === "upsell"
        ? (r.applied_discount_percent ?? r.appliedDiscountPercent ?? r.discountPercent)
        : undefined;
    const applied_discount_percent =
      typeof appliedRaw === "number" && Number.isFinite(appliedRaw)
        ? Math.min(100, Math.max(0, Math.round(appliedRaw)))
        : undefined;
    const expectedRaw =
      checkoutSource === "upsell"
        ? (r.expected_unit_price ?? r.expectedUnitPrice ?? r.price)
        : undefined;
    const expected_unit_price =
      typeof expectedRaw === "number" && Number.isFinite(expectedRaw)
        ? Math.round(expectedRaw)
        : undefined;
    out.push({
      productId,
      variantId,
      quantity: qty,
      clientImage,
      checkoutSource,
      applied_discount_percent,
      expected_unit_price,
    });
  }
  return out.length ? out : null;
}

function mergeLineKey(line: ParsedLine): string {
  const ups = line.checkoutSource === "upsell" ? "u" : "n";
  return `${line.productId}\0${line.variantId ?? ""}\0${ups}`;
}

function mergeLines(lines: ParsedLine[]): ParsedLine[] {
  const map = new Map<string, ParsedLine>();
  for (const line of lines) {
    const key = mergeLineKey(line);
    const prev = map.get(key);
    if (prev) {
      prev.quantity += line.quantity;
      if (!prev.clientImage && line.clientImage) prev.clientImage = line.clientImage;
      if (prev.checkoutSource === "upsell" && line.checkoutSource === "upsell") {
        prev.applied_discount_percent = prev.applied_discount_percent ?? line.applied_discount_percent;
        prev.expected_unit_price = prev.expected_unit_price ?? line.expected_unit_price;
      }
    } else {
      map.set(key, { ...line });
    }
  }
  return Array.from(map.values());
}

function productDiscountInputFromRow(row: ProductRow, listUnit: number): ProductDiscountInput {
  return {
    price: listUnit,
    discount_enabled: row.discount_enabled === true ? true : false,
    discount_max_percent: row.discount_max_percent,
    discount_steps: row.discount_steps,
    discount_label: row.discount_label,
  };
}

function firstImageUrl(images: string[] | null | undefined, fallback?: string): string {
  const raw = Array.isArray(images) && images[0] ? String(images[0]) : fallback ?? "";
  return normalizeOptimizedImageUrl(raw);
}

function buildOrderLine(params: {
  p: ProductRow;
  variant: VariantRow | undefined;
  variantLabel: string | undefined;
  image: string;
  quantity: number;
  listUnit: number;
  unitPrice: number;
  discountPercent: number;
  discountSource: OrderLineDiscountSource;
}): RecalculatedOrderLine {
  const orig = Math.round(params.listUnit);
  const unit = Math.max(0, Math.round(params.unitPrice));
  const qty = Math.max(1, Math.floor(params.quantity));
  const lt = Math.round(unit * qty);
  const dp = Math.min(100, Math.max(0, Math.round(params.discountPercent)));
  return {
    product_id: params.p.id,
    name: params.p.name,
    price: unit,
    quantity: qty,
    image: params.image,
    variant: params.variantLabel,
    variant_id: params.variant?.id,
    original_unit_price: orig,
    discount_percent: dp,
    unit_price: unit,
    line_total: lt,
    discount_source: params.discountSource,
  };
}

/**
 * Recalcula ítems, subtotal, envío y total desde Supabase (admin).
 * No usa precios del cliente como fuente de verdad, salvo referencia `expected_unit_price` en upsell.
 */
export async function recalculateCheckoutOrder(
  admin: SupabaseClient<Database>,
  rawItems: unknown
): Promise<RecalculateCheckoutOrderResult> {
  const parsed = parseIncomingLines(rawItems);
  if (parsed === null) {
    return {
      ok: false,
      error: "El carrito no tiene productos válidos o hay cantidades inválidas.",
      status: 400,
    };
  }

  const merged = mergeLines(parsed);
  const productIds = Array.from(new Set(merged.map((m) => m.productId)));

  const { data: productsRaw, error: pErr } = await admin
    .from("products")
    .select(
      "id,name,price,stock,active,has_variants,images,discount_enabled,discount_max_percent,discount_steps,discount_label"
    )
    .in("id", productIds)
    .eq("active", true);

  if (pErr) {
    console.error("[checkout-price] error cargando productos", pErr.message);
    return { ok: false, error: "No pudimos validar tu carrito. Intenta de nuevo.", status: 500 };
  }

  const products = (productsRaw ?? []) as unknown as ProductRow[];
  const productMap = new Map(products.map((p) => [p.id, p]));
  if (productMap.size !== productIds.length) {
    return {
      ok: false,
      error: "Un producto de tu carrito ya no está disponible o fue desactivado.",
      status: 400,
    };
  }

  const variantIds = Array.from(
    new Set(merged.map((m) => m.variantId).filter((v): v is string => Boolean(v)))
  );

  let variantMap = new Map<string, VariantRow>();
  if (variantIds.length > 0) {
    const { data: variantsRaw, error: vErr } = await admin
      .from("product_variants")
      .select("id,product_id,title,price,stock,active,image_url")
      .in("id", variantIds);

    if (vErr) {
      console.error("[checkout-price] error cargando variantes", vErr.message);
      return { ok: false, error: "No pudimos validar las variantes del carrito.", status: 500 };
    }
    const variants = (variantsRaw ?? []) as unknown as VariantRow[];
    variantMap = new Map(variants.map((v) => [v.id, v]));
    if (variantMap.size !== variantIds.length) {
      return {
        ok: false,
        error: "Una variante elegida ya no está disponible.",
        status: 400,
      };
    }
  }

  const linesOut: RecalculatedOrderLine[] = [];

  for (const line of merged) {
    const p = productMap.get(line.productId)!;

    let listUnit = Number(p.price);
    if (!Number.isFinite(listUnit) || listUnit < 0) {
      return { ok: false, error: "Hay un producto con precio inválido en el catálogo.", status: 500 };
    }
    listUnit = Math.round(listUnit);

    let variant: VariantRow | undefined;
    let variantLabel: string | undefined;
    let stockAvailable = Number(p.stock);

    if (p.has_variants) {
      if (!line.variantId) {
        return {
          ok: false,
          error: `Debes elegir una variante para «${p.name}». Vuelve a agregar el producto desde la ficha (con variante) o vacía el carrito y añádelo de nuevo.`,
          status: 400,
        };
      }
      variant = variantMap.get(line.variantId);
      if (!variant || variant.product_id !== p.id) {
        return {
          ok: false,
          error: "Una variante no corresponde al producto o ya no existe.",
          status: 400,
        };
      }
      if (!variant.active) {
        return {
          ok: false,
          error: `La variante seleccionada de «${p.name}» ya no está disponible.`,
          status: 400,
        };
      }
      const vp = Number(variant.price);
      if (!Number.isFinite(vp) || vp < 0) {
        return { ok: false, error: "Hay una variante con precio inválido.", status: 500 };
      }
      listUnit = Math.round(vp);
      variantLabel = variant.title?.trim() || undefined;
      stockAvailable = Number(variant.stock);
    } else if (line.variantId) {
      // Carrito antiguo con variant_id huérfano: ignorar y usar producto simple
    }

    if (!Number.isFinite(stockAvailable) || stockAvailable < line.quantity) {
      return {
        ok: false,
        error: `Stock insuficiente para «${p.name}»${variantLabel ? ` (${variantLabel})` : ""}.`,
        status: 400,
      };
    }

    const image = variant?.image_url
      ? normalizeOptimizedImageUrl(variant.image_url)
      : firstImageUrl(p.images, line.clientImage);

    if (line.checkoutSource === "upsell") {
      if (p.has_variants) {
        return {
          ok: false,
          error: `La oferta no aplica a «${p.name}» con variantes. Elimínalo y elige variante desde la ficha.`,
          status: 400,
        };
      }
      // Upsell: % FIJO desde `applied_discount_percent` del cliente,
      // acotado por `discount_max_percent`. NO usa discount_steps.
      // Si discount_enabled=false ⇒ sin descuento (precio lista).
      const enabled = p.discount_enabled === true;
      const cap = Math.min(
        100,
        Math.max(0, Math.round(Number(p.discount_max_percent) || 0))
      );
      const requested = Math.max(
        0,
        Math.round(Number(line.applied_discount_percent) || 0)
      );
      const allowedPercent = enabled ? Math.min(requested, cap) : 0;
      const unitPrice = Math.round(listUnit * (1 - allowedPercent / 100));
      if (line.expected_unit_price !== undefined && process.env.NODE_ENV === "development") {
        const exp = Math.round(line.expected_unit_price);
        if (Number.isFinite(exp) && Math.abs(exp - unitPrice) > 1) {
          console.info("[checkout-price] upsell expected_unit_price ≠ servidor (cliente)", {
            name: p.name,
            expected: exp,
            serverUnit: unitPrice,
            clientPct: line.applied_discount_percent,
            serverPct: allowedPercent,
            quantity: line.quantity,
          });
        }
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return { ok: false, error: "No se pudo calcular el precio de un ítem en oferta.", status: 500 };
      }
      linesOut.push(
        buildOrderLine({
          p,
          variant,
          variantLabel,
          image,
          quantity: line.quantity,
          listUnit,
          unitPrice,
          discountPercent: allowedPercent,
          discountSource: "upsell",
        })
      );
    } else {
      const discountInput = productDiscountInputFromRow(p, listUnit);
      const unitPrice = getDiscountedUnitPrice(discountInput, line.quantity, listUnit);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return { ok: false, error: "No se pudo calcular el precio de un ítem.", status: 500 };
      }
      const pct = getApplicableProductDiscount(discountInput, line.quantity);
      linesOut.push(
        buildOrderLine({
          p,
          variant,
          variantLabel,
          image,
          quantity: line.quantity,
          listUnit,
          unitPrice,
          discountPercent: pct,
          discountSource: "quantity",
        })
      );
    }
  }

  const subtotal = linesOut.reduce((acc, row) => acc + row.line_total, 0);
  const subRounded = Math.round(subtotal);
  if (!Number.isFinite(subRounded) || subRounded < 0) {
    return { ok: false, error: "Subtotal inválido.", status: 500 };
  }

  const storeSettings = await getStoreSettings();
  const shippingCost = computeShippingCostClp(
    subRounded,
    storeSettings.shipping_cost_clp,
    storeSettings.shipping_free_threshold_clp
  );
  const total = Math.round(subRounded + shippingCost);

  return {
    ok: true,
    items: linesOut,
    subtotal: subRounded,
    shippingCost,
    total,
  };
}
