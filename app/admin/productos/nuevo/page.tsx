"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Plus, X, Upload, GripVertical } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { createProductAction } from "./actions";
import { compressImageIfNeeded } from "@/lib/images/compressImage";
import { ECOMMERCE_CATEGORIES } from "@/lib/product/categories";
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
import { ProductSectionsBuilder } from "@/components/admin/product-sections/ProductSectionsBuilder";

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

const CATEGORIES = [...ECOMMERCE_CATEGORIES];

// ─── Types ────────────────────────────────────────────────────────────────────

type ImageItem = { id: string; file: File; preview: string };
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
  const fileRef = useRef<HTMLInputElement>(null);
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
  });
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [hasRealVariants, setHasRealVariants] = useState(false);
  const [quantityValues, setQuantityValues] = useState("");
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

  // Images
  const [images, setImages] = useState<ImageItem[]>([]);
  const [dropOver, setDropOver] = useState(false);
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);

  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountMaxPercent, setDiscountMaxPercent] = useState(
    String(ADMIN_DEFAULT_MAX_PERCENT)
  );
  const [discountLabel, setDiscountLabel] = useState(ADMIN_DEFAULT_LABEL);
  const [discountSteps, setDiscountSteps] = useState<VolumeDiscountStepRow[]>([]);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => images.forEach((img) => URL.revokeObjectURL(img.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── Image helpers ───────────────────────────────────────────────────────────

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!valid.length) return;
    const processed = await Promise.all(valid.map((file) => compressImageIfNeeded(file)));
    processed.forEach((p) => {
      if (p.compressed) {
        console.log("[image-compress] original:", p.originalSize, "compressed:", p.compressedSize, "reduction:", `${p.reducedPercent}%`);
      }
    });
    setImages((prev) => [
      ...prev,
      ...processed.map((result) => ({
        id: `${Date.now()}-${Math.random()}`,
        file: result.file,
        preview: URL.createObjectURL(result.file),
      })),
    ]);
  }, []);

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDropOver(false);
    await addFiles(e.dataTransfer.files);
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((i) => i.id !== id);
    });
  }

  // Drag-to-reorder thumbnails
  function handleThumbDragOver(e: React.DragEvent, toIdx: number) {
    e.preventDefault();
    if (dragSrcIdx === null || dragSrcIdx === toIdx) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragSrcIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragSrcIdx(toIdx);
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
      fd.append("image_count", String(images.length));
      images.forEach((img, i) => fd.append(`image_${i}`, img.file));

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
  const canSave = hasRealVariants
    ? canSaveBase && canSaveWithVariants
    : canSaveBase && Number(form.price) > 0;

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

            {/* Bloques modulares (Fase 2B) */}
            <ProductSectionsBuilder
              initialSections={[]}
              hiddenInputName="product_sections_json"
            />

            {/* Images */}
            <Card title="Imágenes">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void addFiles(e.target.files ?? []);
                }}
              />

              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropOver(true);
                }}
                onDragLeave={() => setDropOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={clsx(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 transition-colors",
                  dropOver
                    ? "border-[var(--color-primary)] bg-zinc-50"
                    : "border-zinc-200 hover:border-zinc-400"
                )}
              >
                <Upload
                  className={clsx(
                    "h-7 w-7 transition-colors",
                    dropOver ? "text-[var(--color-primary)]" : "text-zinc-400"
                  )}
                />
                <p className="text-sm font-medium text-zinc-600">
                  Arrastra imágenes aquí o{" "}
                  <span className="text-[var(--color-primary)]">
                    haz clic para seleccionar
                  </span>
                </p>
                <p className="text-xs text-zinc-400">
                  PNG, JPG, WebP · múltiples archivos · se suben al bucket
                  &ldquo;products&rdquo;
                </p>
              </div>

              {/* Thumbnail grid */}
              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {images.map((img, i) => (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        setDragSrcIdx(i);
                      }}
                      onDragOver={(e) => handleThumbDragOver(e, i)}
                      onDragEnd={() => setDragSrcIdx(null)}
                      className={clsx(
                        "group relative aspect-square cursor-grab overflow-hidden rounded-lg border-2 transition-all active:cursor-grabbing",
                        dragSrcIdx === i
                          ? "opacity-40 border-[var(--color-primary)]"
                          : "border-zinc-200 hover:border-zinc-400"
                      )}
                    >
                      <Image
                        src={img.preview}
                        alt={`Imagen ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="80px"
                        unoptimized
                      />

                      {/* Drag handle */}
                      <div className="absolute left-1 top-1 hidden group-hover:flex">
                        <GripVertical className="h-3.5 w-3.5 text-white drop-shadow" />
                      </div>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(img.id);
                        }}
                        className="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-zinc-900/80 text-white group-hover:flex"
                      >
                        <X className="h-3 w-3" />
                      </button>

                      {/* Principal badge */}
                      {i === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-zinc-900/70 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wider text-white">
                          Principal
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
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
              <select
                className={inputCls}
                value={form.category}
                onChange={field("category")}
              >
                <option value="">Sin categoría</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
