"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { createProductAction } from "./actions";
import {
  ADMIN_DEFAULT_LABEL,
  ADMIN_DEFAULT_MAX_PERCENT,
  validateVolumeDiscountForSave,
  volumeDiscountFormRowsToSteps,
} from "@/lib/admin/productVolumeDiscounts";
import {
  ProductVolumeDiscountSection,
  defaultVolumeDiscountStepRows,
  type VolumeDiscountStepRow,
} from "@/components/admin/ProductVolumeDiscountSection";
import { ProductGallerySelector } from "@/components/admin/ProductGallerySelector";
import { ProductMediaLibrary } from "@/components/admin/ProductMediaLibrary";
import {
  ProductSectionsBuilder,
  type ProductSectionsBuilderHandle,
} from "@/components/admin/product-sections/ProductSectionsBuilder";
import { findSectionsUsingImage } from "@/lib/product/sections/imageUsage";
import type { ProductSectionList } from "@/lib/product/sections/types";
import type { AIProductDraft } from "@/lib/ai-product-studio/schema";
import { readAndClearAIStudioBridge } from "@/lib/ai-product-studio/bridge";

// ─── Rich text editor (client-only) ──────────────────────────────────────────

const QuillEditor = dynamic(() => import("@/components/admin/QuillEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-48 animate-pulse rounded-[var(--radius-sm)] bg-zinc-100" />
  ),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = { name: string; values: string };
type VariantRow = {
  optionValue: string;
  price: string;
  compare_at_price: string;
  cost_price: string;
  stock: string;
  badge_text: string;
  active: boolean;
};

// ─── Shared input style ───────────────────────────────────────────────────────

const inputCls =
  "h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]";

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      {title && (
        <div className="border-b border-zinc-100 px-5 py-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {title}
          </h2>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NuevoProductoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form fields
  const [form, setForm] = useState({
    name: "",
    slug: "",
    price: "",
    compare_at_price: "",
    cost_price: "",
    stock: "0",
    category: "",
    dropi_product_url: "",
  });
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [hasRealVariants, setHasRealVariants] = useState(false);
  const [quantityValues, setQuantityValues] = useState("");
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

  // Biblioteca de medios: TODAS las imágenes subidas (URLs reales de R2, se
  // suben al elegir el archivo, no al guardar el producto). Es la fuente para
  // elegir tanto la galería pública como las imágenes de "Bloques de la
  // ficha" — nunca se renderiza completa en el storefront.
  const [productMedia, setProductMedia] = useState<string[]>([]);
  // Galería pública: subconjunto ordenado de `productMedia`, elegido a mano.
  // La primera imagen es la portada en catálogo/tarjetas/ficha.
  const [images, setImages] = useState<string[]>([]);
  const [imagesUploading, setImagesUploading] = useState(false);
  // Espejo de solo lectura de los bloques modulares, solo para poder avisar
  // "esta imagen se usa en..." al borrar de la biblioteca (ver ProductSectionsBuilder).
  const [sectionsSnapshot, setSectionsSnapshot] = useState<ProductSectionList>([]);
  const sectionsBuilderRef = useRef<ProductSectionsBuilderHandle>(null);

  // Estudio IA de Producto: si se llega desde /admin/productos/crear-con-ia,
  // el borrador viaja por sessionStorage (ver lib/ai-product-studio/bridge.ts)
  // y se aplica una sola vez al montar. Los bloques modulares se vuelcan en
  // `aiSections` y se fuerza un remount de ProductSectionsBuilder (es
  // uncontrolled — solo lee `initialSections` al montar) subiendo la key.
  const [aiSections, setAiSections] = useState<ProductSectionList | null>(null);
  const [sectionsResetKey, setSectionsResetKey] = useState(0);
  const [appliedFromAIStudio, setAppliedFromAIStudio] = useState(false);

  function handleApplyAIDraft(draft: AIProductDraft) {
    setForm((f) => ({
      ...f,
      name: draft.name || f.name,
      slug: draft.slug || f.slug,
      category: draft.category || f.category,
    }));
    if (draft.description) setDescription(draft.description);
    if (draft.images.length > 0) {
      setProductMedia((prev) => Array.from(new Set([...prev, ...draft.images])));
      setImages(draft.images);
    }
    setAiSections(draft.product_sections);
    setSectionsResetKey((k) => k + 1);
  }

  useEffect(() => {
    const bridged = readAndClearAIStudioBridge();
    if (!bridged) return;
    setProductMedia(bridged.productMedia);
    handleApplyAIDraft(bridged.draft);
    setAppliedFromAIStudio(true);
    toast.success("Borrador del Estudio IA aplicado. Revisa todos los campos antes de guardar.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function findMediaUsage(url: string) {
    const refs: { id: string; label: string }[] = [];
    if (images.includes(url)) refs.push({ id: "gallery", label: "Galería principal" });
    refs.push(...findSectionsUsingImage(sectionsSnapshot, url));
    return refs;
  }

  function handleDeleteMedia(url: string) {
    setProductMedia((prev) => prev.filter((u) => u !== url));
    setImages((prev) => prev.filter((u) => u !== url));
    sectionsBuilderRef.current?.purgeImageReference(url);
  }

  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountMaxPercent, setDiscountMaxPercent] = useState(
    String(ADMIN_DEFAULT_MAX_PERCENT)
  );
  const [discountLabel, setDiscountLabel] = useState(ADMIN_DEFAULT_LABEL);
  const [discountSteps, setDiscountSteps] = useState<VolumeDiscountStepRow[]>([]);

  // ── Form helpers ────────────────────────────────────────────────────────────

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, slug: slugify(name) }));
  }

  function field(key: keyof typeof form) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  // ── Variant helpers ─────────────────────────────────────────────────────────

  function addVariant() {
    setVariants((v) => [...v, { name: "", values: "" }]);
  }
  function updateVariant(i: number, key: keyof Variant, val: string) {
    setVariants((v) =>
      v.map((vr, idx) => (idx === i ? { ...vr, [key]: val } : vr))
    );
  }
  function removeVariant(i: number) {
    setVariants((v) => v.filter((_, idx) => idx !== i));
  }

  // ── Real variant helpers ────────────────────────────────────────────────────

  function syncVariantRowsFromValues(valuesInput: string) {
    const values = valuesInput
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    setVariantRows((prev) =>
      values.map((value) => {
        const existing = prev.find((r) => r.optionValue === value);
        if (existing) {
          return existing;
        }
        return {
          optionValue: value,
          price: form.price || "",
          compare_at_price: form.compare_at_price || "",
          cost_price: "",
          stock: form.stock || "0",
          badge_text: "",
          active: true,
        };
      })
    );
  }

  function updateVariantRow(i: number, key: keyof VariantRow, value: string | boolean) {
    setVariantRows((rows) =>
      rows.map((row, idx) => (idx === i ? { ...row, [key]: value } : row))
    );
  }

  function handleVolumeDiscountEnabled(v: boolean) {
    if (v && discountSteps.length === 0) {
      setDiscountMaxPercent(String(ADMIN_DEFAULT_MAX_PERCENT));
      setDiscountLabel(ADMIN_DEFAULT_LABEL);
      setDiscountSteps(defaultVolumeDiscountStepRows());
    }
    setDiscountEnabled(v);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("El nombre es obligatorio.");
    if (!form.slug.trim()) return toast.error("El slug es obligatorio.");
    if (!hasRealVariants && (!form.price || Number(form.price) <= 0))
      return toast.error("Ingresa un precio válido.");
    if (
      hasRealVariants &&
      !variantRows.some((r) => r.active && Number(r.price) > 0)
    ) {
      return toast.error("Ingresa al menos una variante activa con precio válido");
    }

    const stepsNum = volumeDiscountFormRowsToSteps(discountSteps);
    const volumeCheck = validateVolumeDiscountForSave(
      discountEnabled,
      Number(discountMaxPercent),
      discountLabel.trim() || null,
      stepsNum
    );
    if (!volumeCheck.ok) {
      return toast.error(volumeCheck.error);
    }
    if (imagesUploading) {
      return toast.error("Espera a que terminen de subirse las imágenes.");
    }
    if (active && images.length === 0) {
      return toast.error("Un producto activo necesita al menos una imagen en la galería principal.");
    }

    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("description", description);
      fd.append("active", String(active));
      fd.append("has_variants", String(hasRealVariants));
      fd.append("variants", JSON.stringify(hasRealVariants ? [] : variants));
      fd.append(
        "options_json",
        JSON.stringify(
          hasRealVariants
            ? [
                {
                  name: "Cantidad",
                  values: variantRows.map((r) => r.optionValue),
                },
              ]
            : null
        )
      );
      fd.append(
        "variant_rows_json",
        JSON.stringify(
          hasRealVariants
            ? variantRows.map((r, idx) => ({
                title: r.optionValue,
                option_values: { Cantidad: r.optionValue },
                price: Number(r.price || 0),
                compare_at_price: r.compare_at_price ? Number(r.compare_at_price) : null,
                cost_price: r.cost_price ? Number(r.cost_price) : null,
                stock: Number(r.stock || 0),
                badge_text: r.badge_text.trim() || null,
                image_url: null,
                active: r.active,
                position: idx,
              }))
            : []
        )
      );
      // Imágenes ya subidas a R2 — solo viajan sus URLs. `images` es la
      // galería pública seleccionada; `product_media` es la biblioteca completa.
      fd.append("images_json", JSON.stringify(images));
      fd.append("product_media_json", JSON.stringify(productMedia));

      // ── Bloques modulares ───────────────────────────────────────────────
      // El builder pinta un <input type="hidden" name="product_sections_json" />
      // dentro de este mismo <form>. Como construimos el FormData a mano (no
      // desde el form DOM, para poder mezclar Files manualmente), tenemos que
      // leer su valor explícitamente.
      const formEl = e.currentTarget as HTMLFormElement;
      const sectionsInput = formEl.querySelector<HTMLInputElement>(
        'input[name="product_sections_json"]'
      );
      fd.append("product_sections_json", sectionsInput?.value ?? "[]");

      fd.append("discount_enabled", volumeCheck.data.discount_enabled ? "true" : "false");
      if (volumeCheck.data.discount_enabled) {
        fd.append("discount_max_percent", String(volumeCheck.data.discount_max_percent));
        fd.append("discount_label", volumeCheck.data.discount_label ?? "");
        fd.append("discount_steps_json", JSON.stringify(volumeCheck.data.discount_steps));
      }

      const result = await createProductAction(fd);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Producto creado correctamente.");
        router.push("/admin/productos");
      }
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const canSaveBase = !!form.name.trim() && !!form.slug.trim();
  const canSaveWithVariants = variantRows.some(
    (r) => r.active && Number(r.price) > 0
  );
  const canSave =
    (hasRealVariants
      ? canSaveBase && canSaveWithVariants
      : canSaveBase && Number(form.price) > 0) &&
    !imagesUploading &&
    (!active || images.length > 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/productos"
          className="text-zinc-400 transition-colors hover:text-zinc-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-2xl font-bold text-zinc-900">
          Nuevo producto
        </h1>
      </div>

      {appliedFromAIStudio && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Este borrador viene del <strong>Estudio IA (modo demo)</strong>. Revisa todos los campos —
            especialmente los marcados &quot;por confirmar&quot; — antes de guardar.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ── Two-column Shopify layout ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-6">

            {/* Title & Slug */}
            <Card title="Información del producto">
              <div className="flex flex-col gap-4">
                <Input
                  label="Nombre *"
                  placeholder="Zapatilla Urbana Negra"
                  value={form.name}
                  onChange={handleNameChange}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">
                    Slug (URL)
                  </label>
                  <div className="flex items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-zinc-50 px-3 text-sm">
                    <span className="shrink-0 text-zinc-400">
                      /productos/
                    </span>
                    <input
                      className="flex-1 bg-transparent py-2 pl-0.5 outline-none"
                      value={form.slug}
                      onChange={field("slug")}
                      placeholder="zapatilla-urbana-negra"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Description */}
            <Card title="Descripción">
              <QuillEditor
                value={description}
                onChange={setDescription}
                placeholder="Describe el producto: materiales, dimensiones, instrucciones de uso..."
              />
              <p className="mt-2 text-xs text-zinc-400">
                Si agregas bloques modulares más abajo, estos reemplazan a la
                descripción HTML en la ficha pública.
              </p>
            </Card>

            {/* Biblioteca de medios: todas las imágenes subidas, no es la galería pública */}
            <Card title="Biblioteca de medios">
              <ProductMediaLibrary
                images={productMedia}
                onChange={setProductMedia}
                findUsage={findMediaUsage}
                onDelete={handleDeleteMedia}
                onUploadingChange={setImagesUploading}
              />
            </Card>

            {/* Galería principal del producto — obligatoria para activar */}
            <Card title="Galería principal *">
              <ProductGallerySelector library={productMedia} gallery={images} onChange={setImages} />
            </Card>

            {/* Bloques modulares (Fase 2B). key fuerza remount cuando el
                Estudio IA aplica un borrador (el builder es uncontrolled). */}
            <ProductSectionsBuilder
              key={sectionsResetKey}
              ref={sectionsBuilderRef}
              initialSections={aiSections ?? []}
              hiddenInputName="product_sections_json"
              images={productMedia}
              onSectionsChange={setSectionsSnapshot}
            />
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex flex-col gap-6">

            {/* Price & stock */}
            <Card title="Precio y stock">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                    Precio CLP *
                  </label>
                  <div className="flex items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white">
                    <span className="border-r border-[var(--color-border)] px-3 py-2 text-sm text-zinc-500">
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      placeholder="49990"
                      value={form.price}
                      onChange={field("price")}
                      className="input-money flex-1 bg-transparent px-3 py-2 text-base text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                    Precio comparativo (oferta)
                  </label>
                  <div className="flex items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white">
                    <span className="border-r border-[var(--color-border)] px-3 py-2 text-sm text-zinc-500">
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      placeholder="79990"
                      value={form.compare_at_price}
                      onChange={field("compare_at_price")}
                      className="input-money flex-1 bg-transparent px-3 py-2 text-base text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] outline-none"
                    />
                  </div>
                  {form.compare_at_price && Number(form.compare_at_price) > 0 && (
                    <p className="mt-1.5 text-xs text-zinc-400">
                      El precio anterior se muestra tachado en la tienda.
                    </p>
                  )}
                </div>

                {!hasRealVariants && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                      Precio costo
                    </label>
                    <div className="flex items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white">
                      <span className="border-r border-[var(--color-border)] px-3 py-2 text-sm text-zinc-500">
                        $
                      </span>
                      <input
                        type="number"
                        min={0}
                        placeholder="25000"
                        value={form.cost_price}
                        onChange={field("cost_price")}
                        className="input-money flex-1 bg-transparent px-3 py-2 text-base text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] outline-none"
                      />
                    </div>
                  </div>
                )}

                <Input
                  label="Stock"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.stock}
                  onChange={field("stock")}
                  className="input-money"
                />
              </div>
            </Card>

            {/* Category */}
            <Card title="Categoría">
              <Input
                placeholder="Ej: Hogar, Tecnología, Accesorios..."
                value={form.category}
                onChange={field("category")}
              />
            </Card>

            <Card title="Dropi (opcional)">
              <Input
                label="URL del producto en Dropi"
                type="url"
                placeholder="https://app.dropi.cl/..."
                value={form.dropi_product_url}
                onChange={field("dropi_product_url")}
                helperText="Enlace al producto dentro de app.dropi.cl o app.dropi.co. Solo lo ve el admin, nunca aparece en la tienda pública."
              />
            </Card>

            <ProductVolumeDiscountSection
              enabled={discountEnabled}
              onEnabledChange={handleVolumeDiscountEnabled}
              maxPercent={discountMaxPercent}
              onMaxPercentChange={setDiscountMaxPercent}
              label={discountLabel}
              onLabelChange={setDiscountLabel}
              steps={discountSteps}
              onStepsChange={setDiscountSteps}
            />

            {/* Product type */}
            <Card title="Tipo de producto">
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setHasRealVariants((v) => !v)}
                  className="flex items-center gap-3"
                >
                  <div
                    className={clsx(
                      "relative h-6 w-11 rounded-full transition-colors duration-200",
                      hasRealVariants ? "bg-zinc-900" : "bg-zinc-300"
                    )}
                  >
                    <span
                      className={clsx(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                        hasRealVariants ? "translate-x-5" : "translate-x-0.5"
                      )}
                    />
                  </div>
                  <span className="text-sm text-zinc-700">
                    Producto con variantes
                  </span>
                </button>

                <p className="text-xs text-zinc-400">
                  {hasRealVariants
                    ? "Modo variantes activado: edita los valores en el bloque de ancho completo."
                    : "Modo simple: usa precio/stock base y variantes básicas opcionales."}
                </p>
              </div>
            </Card>

            {/* Simple variants (legacy mode only) */}
            {!hasRealVariants && (
              <Card title="Variantes (modo simple)">
                <div className="flex flex-col gap-3">
                  {variants.length === 0 ? (
                    <p className="text-xs text-zinc-400">
                      Ej: Talla → S, M, L, XL
                    </p>
                  ) : (
                    variants.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Talla"
                          value={v.name}
                          onChange={(e) => updateVariant(i, "name", e.target.value)}
                          className={clsx(inputCls, "w-24 shrink-0")}
                        />
                        <input
                          type="text"
                          placeholder="S, M, L"
                          value={v.values}
                          onChange={(e) =>
                            updateVariant(i, "values", e.target.value)
                          }
                          className={clsx(inputCls, "flex-1")}
                        />
                        <button
                          type="button"
                          onClick={() => removeVariant(i)}
                          className="shrink-0 text-zinc-400 transition-colors hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={addVariant}
                    className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar variante
                  </button>
                </div>
              </Card>
            )}

            {/* Visibility */}
            <Card title="Visibilidad">
              <button
                type="button"
                onClick={() => setActive((a) => !a)}
                className="flex items-center gap-3"
              >
                <div
                  className={clsx(
                    "relative h-6 w-11 rounded-full transition-colors duration-200",
                    active ? "bg-zinc-900" : "bg-zinc-300"
                  )}
                >
                  <span
                    className={clsx(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                      active ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </div>
                <span className="text-sm text-zinc-700">
                  {active ? (
                    <span>
                      <span className="font-semibold">Activo</span> — visible en la tienda
                    </span>
                  ) : (
                    <span>
                      <span className="font-semibold">Inactivo</span> — oculto
                    </span>
                  )}
                </span>
              </button>
              {active && images.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  Para activarlo agrega al menos una imagen en la Galería principal.
                </p>
              )}
            </Card>

            {/* Actions */}
            <div className="flex flex-col gap-2 pb-10">
              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={loading}
                disabled={!canSave}
              >
                Guardar producto
              </Button>
              <Link href="/admin/productos" className="w-full">
                <Button type="button" variant="secondary" size="lg" fullWidth>
                  Descartar
                </Button>
              </Link>
            </div>

          </div>

          {/* ── Full-width real variants editor ── */}
          {hasRealVariants && (
            <div className="lg:col-span-2">
              <Card title="Variantes reales">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-zinc-700">Opción</label>
                      <input
                        className={clsx(inputCls, "h-10 px-3.5")}
                        value="Cantidad"
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-zinc-700">
                        Valores (separados por coma)
                      </label>
                      <input
                        className={clsx(inputCls, "h-10 px-3.5")}
                        placeholder="Ej: 4kg, 12kg, 24kg"
                        value={quantityValues}
                        onChange={(e) => {
                          setQuantityValues(e.target.value);
                          syncVariantRowsFromValues(e.target.value);
                        }}
                      />
                      <p className="text-xs text-zinc-400">Ej: 4kg, 12kg, 24kg</p>
                    </div>
                  </div>

                  {variantRows.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-zinc-200">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[1040px] text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                              <th className="px-3 py-3">Variante</th>
                              <th className="px-3 py-3">Precio venta</th>
                              <th className="px-3 py-3">Precio comparación</th>
                              <th className="px-3 py-3">Precio costo</th>
                              <th className="px-3 py-3">Stock</th>
                              <th className="px-3 py-3">Etiqueta visible</th>
                              <th className="px-3 py-3 text-center">Activa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 bg-white">
                            {variantRows.map((row, i) => (
                              <tr key={row.optionValue} className="align-middle">
                                <td className="px-3 py-3 font-medium text-zinc-800">
                                  {row.optionValue}
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    className={clsx(inputCls, "input-money h-10 px-3.5")}
                                    type="number"
                                    min={0}
                                    placeholder="Precio venta"
                                    value={row.price}
                                    onChange={(e) => updateVariantRow(i, "price", e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    className={clsx(inputCls, "input-money h-10 px-3.5")}
                                    type="number"
                                    min={0}
                                    placeholder="Precio antes"
                                    value={row.compare_at_price}
                                    onChange={(e) =>
                                      updateVariantRow(i, "compare_at_price", e.target.value)
                                    }
                                  />
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    className={clsx(inputCls, "input-money h-10 px-3.5")}
                                    type="number"
                                    min={0}
                                    placeholder="Costo"
                                    value={row.cost_price}
                                    onChange={(e) => updateVariantRow(i, "cost_price", e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    className={clsx(inputCls, "input-money h-10 px-3.5")}
                                    type="number"
                                    min={0}
                                    placeholder="Stock"
                                    value={row.stock}
                                    onChange={(e) => updateVariantRow(i, "stock", e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    className={clsx(inputCls, "h-10 px-3.5")}
                                    placeholder="Ej: 🔥 Más vendido"
                                    value={row.badge_text}
                                    onChange={(e) => updateVariantRow(i, "badge_text", e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={row.active}
                                    onChange={(e) => updateVariantRow(i, "active", e.target.checked)}
                                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
                      Escribe valores en Cantidad para generar las variantes.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
