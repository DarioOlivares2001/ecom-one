import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Json } from "@/lib/db/types";
import {
  getDiscountedUnitPrice,
  type ProductDiscountInput,
} from "@/lib/discounts";
import { isAllowedImageSrc } from "@/lib/images/isAllowedImageSrc";

export type CartLineMatch = {
  variant?: string;
  variant_id?: string;
};

export interface CartItem {
  product_id: string;
  /** True si el producto requiere elegir variante en la ficha (persistido para validar carrito/checkout). */
  has_variants?: boolean;
  /** Slug para enlazar «Corregir» desde carrito/checkout. */
  product_slug?: string;
  variant_id?: string;
  name: string;
  /** Precio unitario efectivo (tras descuento por cantidad si aplica). */
  price: number;
  quantity: number;
  image: string;
  variant?: string;
  option_values?: Record<string, string>;
  isUpsellOffer?: boolean;
  /** Origen promocional; `"upsell"` se valida en servidor al pagar. */
  source?: "upsell";
  /** % mostrado/solicitado (upsell); servidor lo acota con `discount_max_percent` del producto. */
  applied_discount_percent?: number;
  /** Precio unitario mostrado al usuario (referencia, no fuente de verdad). */
  expected_unit_price?: number;
  originalPrice?: number;
  discountPercent?: number;
  /** Precio lista unitario (sin descuento por volumen). Carritos viejos: fallback a `price`. */
  unitListPrice?: number;
  discount_enabled?: boolean;
  discount_max_percent?: number;
  discount_steps?: Json;
  discount_label?: string | null;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** `false` si se rechazó (p. ej. variante obligatoria sin `variant_id`). */
  add: (item: CartItem) => boolean;
  remove: (product_id: string, match?: CartLineMatch) => void;
  updateQuantity: (product_id: string, quantity: number, match?: CartLineMatch) => void;
  clear: () => void;
  total: () => number;
  itemCount: () => number;
}

/** Misma línea de carrito: si la línea tiene `variant_id`, el match debe traer el mismo id. */
export function cartLineMatches(
  item: CartItem,
  productId: string,
  match?: CartLineMatch
): boolean {
  if (item.product_id !== productId) return false;
  const wantId = match?.variant_id?.trim() ?? "";
  const gotId = item.variant_id?.trim() ?? "";
  if (gotId) {
    return wantId !== "" && wantId === gotId;
  }
  if (wantId) {
    return false;
  }
  const wantLabel = match?.variant ?? "";
  const gotLabel = item.variant ?? "";
  return wantLabel === gotLabel;
}

function isSameItem(a: CartItem, b: CartItem) {
  if (!cartLineMatches(a, b.product_id, { variant: b.variant, variant_id: b.variant_id })) {
    return false;
  }
  const aUps = a.source === "upsell" || a.isUpsellOffer === true;
  const bUps = b.source === "upsell" || b.isUpsellOffer === true;
  return aUps === bUps;
}

/** IDs reales (products.id / product_variants.id) son siempre UUID (`gen_random_uuid()`). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Carrito persistido sin snapshot de volumen: usar `price` como lista y no aplicar volumen. */
export function normalizeIncomingCartItem(item: CartItem): CartItem {
  const unitListPrice = toFiniteNumber(item.unitListPrice) ?? toFiniteNumber(item.price) ?? 0;
  const steps = item.discount_steps;
  const safeSteps: Json = Array.isArray(steps) ? (steps as Json) : ([] as unknown as Json);
  const vidRaw = item.variant_id;
  const vidCandidate =
    typeof vidRaw === "string" && vidRaw.trim()
      ? vidRaw.trim()
      : typeof vidRaw === "number" && Number.isFinite(vidRaw)
        ? String(vidRaw)
        : undefined;
  // Un variant_id con forma inválida (no-UUID) se descarta como si no viniera:
  // el resto de la línea (name/price/imagen) sigue siendo válido y usable.
  const vid = vidCandidate && isValidId(vidCandidate) ? vidCandidate : undefined;
  const rawImage = typeof item.image === "string" ? item.image : "";
  return {
    ...item,
    image: isAllowedImageSrc(rawImage) ? rawImage : "",
    price: toFiniteNumber(item.price) ?? 0,
    quantity: Math.max(1, Math.floor(toFiniteNumber(item.quantity) ?? 1)),
    variant_id: vid,
    has_variants: item.has_variants === true ? true : item.has_variants === false ? false : undefined,
    product_slug:
      typeof item.product_slug === "string" && item.product_slug.trim()
        ? item.product_slug.trim()
        : undefined,
    source: item.source === "upsell" ? "upsell" : undefined,
    applied_discount_percent:
      typeof item.applied_discount_percent === "number" && Number.isFinite(item.applied_discount_percent)
        ? Math.min(100, Math.max(0, Math.round(item.applied_discount_percent)))
        : undefined,
    expected_unit_price:
      typeof item.expected_unit_price === "number" && Number.isFinite(item.expected_unit_price)
        ? Math.round(item.expected_unit_price)
        : undefined,
    unitListPrice,
    discount_enabled: item.discount_enabled === true,
    discount_max_percent: Number(item.discount_max_percent) || 0,
    discount_steps: safeSteps,
    discount_label: item.discount_label ?? null,
  };
}

/**
 * Valida una línea de carrito recién leída de `localStorage` (o de cualquier
 * fuente no confiable: versión vieja, edición manual, datos corruptos).
 * `null` si la línea es irrecuperable (sin `product_id` válido, sin nombre,
 * o sin precio/cantidad utilizables) — el llamador debe descartarla.
 */
export function sanitizePersistedCartItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const productId = typeof r.product_id === "string" ? r.product_id.trim() : "";
  if (!isValidId(productId)) return null; // ej. IDs mock viejos ("prod-1"), o campo ausente/corrupto

  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;

  const price = toFiniteNumber(r.price);
  if (price === null || price < 0) return null;

  return normalizeIncomingCartItem({
    ...(r as unknown as CartItem),
    product_id: productId,
    name,
    price,
  });
}

/** Línea de carrito inválida para checkout: variante obligatoria sin `variant_id`. */
export function cartItemNeedsVariantFix(item: CartItem): boolean {
  const noVid = !item.variant_id?.trim();
  if (!noVid) return false;
  if (item.has_variants === true) return true;
  const ov = item.option_values;
  if (ov && typeof ov === "object" && !Array.isArray(ov) && Object.keys(ov as object).length > 0) {
    return true;
  }
  return false;
}

export function cartItemToDiscountInput(item: CartItem): ProductDiscountInput {
  const list = item.unitListPrice ?? item.price;
  return {
    price: list,
    discount_enabled: item.discount_enabled,
    discount_max_percent: item.discount_max_percent,
    discount_steps: item.discount_steps,
    discount_label: item.discount_label,
  };
}

function recalcItemPrice(item: CartItem): CartItem {
  const base = normalizeIncomingCartItem(item);
  const isUpsellLine = base.source === "upsell" || base.isUpsellOffer === true;

  if (isUpsellLine) {
    // Línea de UPSELL: precio fijo basado en `applied_discount_percent`,
    // acotado por `discount_max_percent`. NO escala por cantidad
    // (cada unidad mantiene el % del upsell mientras `source === "upsell"`).
    const list = Math.max(0, Number(base.unitListPrice ?? base.price) || 0);
    const enabled = base.discount_enabled === true;
    const cap = Math.min(100, Math.max(0, Number(base.discount_max_percent) || 0));
    const requested = Math.max(0, Math.round(Number(base.applied_discount_percent) || 0));
    const pct = enabled ? Math.min(requested, cap) : 0;
    const unit = Math.round(list * (1 - pct / 100));
    return { ...base, price: unit };
  }

  // Línea normal: descuento por cantidad (step-based) desde `discount_steps`.
  const unit = getDiscountedUnitPrice(cartItemToDiscountInput(base), base.quantity);
  return { ...base, price: unit };
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      openDrawer: () => set({ isOpen: true }),
      closeDrawer: () => set({ isOpen: false }),

      add(item) {
        if (!isValidId(item.product_id)) {
          if (process.env.NODE_ENV === "development") {
            console.warn("Intento de agregar al carrito con product_id inválido", item.product_id);
          }
          return false;
        }
        const normalizedIn = recalcItemPrice(normalizeIncomingCartItem(item));
        if (normalizedIn.has_variants === true && !normalizedIn.variant_id?.trim()) {
          if (process.env.NODE_ENV === "development") {
            console.warn("Producto con variantes no puede agregarse sin variant_id", {
              product_id: normalizedIn.product_id,
              name: normalizedIn.name,
            });
          }
          return false;
        }
        set((state) => {
          const existing = state.items.find((i) => isSameItem(i, normalizedIn));
          if (existing) {
            const merged: CartItem = {
              ...existing,
              quantity: existing.quantity + normalizedIn.quantity,
              variant_id: existing.variant_id ?? normalizedIn.variant_id,
              option_values: normalizedIn.option_values ?? existing.option_values,
              variant: normalizedIn.variant ?? existing.variant,
              has_variants: normalizedIn.has_variants ?? existing.has_variants,
              product_slug: normalizedIn.product_slug ?? existing.product_slug,
              source: normalizedIn.source ?? existing.source,
              applied_discount_percent:
                normalizedIn.applied_discount_percent ?? existing.applied_discount_percent,
              expected_unit_price: normalizedIn.expected_unit_price ?? existing.expected_unit_price,
            };
            return {
              items: state.items.map((i) =>
                isSameItem(i, normalizedIn) ? recalcItemPrice(merged) : i
              ),
            };
          }
          return { items: [...state.items, normalizedIn] };
        });
        return true;
      },

      remove(product_id, match) {
        set((state) => ({
          items: state.items.filter((i) => !cartLineMatches(i, product_id, match)),
        }));
      },

      updateQuantity(product_id, quantity, match) {
        if (quantity < 1) {
          get().remove(product_id, match);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            cartLineMatches(i, product_id, match)
              ? recalcItemPrice({ ...i, quantity })
              : i
          ),
        }));
      },

      clear() {
        set({ items: [] });
      },

      total() {
        return get().items.reduce((acc, i) => acc + i.price * i.quantity, 0);
      },

      itemCount() {
        return get().items.reduce((acc, i) => acc + i.quantity, 0);
      },
    }),
    {
      name: "thegate-cart",
      // v6: valida cada línea persistida (sanitizePersistedCartItem) — descarta
      // líneas con product_id no-UUID (ej. IDs de productos mock ya
      // eliminados), sin nombre, o con precio/cantidad no numéricos, en vez de
      // confiar ciegamente en lo que había en localStorage.
      version: 6,
      migrate: (persisted) => {
        // Defensivo a propósito: zustand ya envuelve `migrate` en un catch
        // interno (un error acá deja el carrito en su estado inicial vacío,
        // nunca rompe la carga de la página), pero devolvemos `{ items: [] }`
        // explícitamente ante cualquier forma inesperada para no depender de eso.
        try {
          const raw = persisted as { items?: unknown } | null | undefined;
          const rawItems = Array.isArray(raw?.items) ? raw.items : [];
          const items: CartItem[] = [];
          for (const rawItem of rawItems) {
            const sanitized = sanitizePersistedCartItem(rawItem);
            if (sanitized) items.push(recalcItemPrice(sanitized));
          }
          return { items };
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[cart] no se pudo migrar el carrito persistido, se reinicia vacío", error);
          }
          return { items: [] };
        }
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error && process.env.NODE_ENV === "development") {
          console.warn("[cart] error leyendo carrito persistido (localStorage corrupto/inválido):", error);
        }
      },
      partialize: (state) => ({ items: state.items }),
    }
  )
);
