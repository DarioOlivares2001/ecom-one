"use client";

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Info,
  Sparkles,
  X,
} from "lucide-react";
import { clsx } from "clsx";

import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { ProductMediaLibrary } from "@/components/admin/ProductMediaLibrary";
import { ProductGallerySelector } from "@/components/admin/ProductGallerySelector";
import { deleteProductImage } from "@/lib/admin/deleteProductImage";
import { generateDemoDraft } from "@/lib/ai-product-studio/generateDemoDraft";
import {
  AI_PRODUCT_STUDIO_TONES,
  AI_PRODUCT_STUDIO_TONE_LABELS,
  aiProductDraftSchema,
  aiProductStudioInputSchema,
  type AIProductDraft,
  type AIProductStudioTone,
} from "@/lib/ai-product-studio/schema";
import { writeAIStudioBridge } from "@/lib/ai-product-studio/bridge";
import { SECTION_REGISTRY } from "@/lib/product/sections/types";

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Información del proveedor",
  2: "Imágenes",
  3: "Vista previa",
};

const IGNORED_TOPICS = [
  "WhatsApp u otro contacto directo del proveedor",
  "Llamadas o avisos para \"confirmar stock\"",
  "Ofertas, descuentos o promociones del proveedor",
  "Entregas o despachos a cargo de terceros",
  "URLs externas (catálogos, redes del proveedor, etc.)",
  "Instrucciones administrativas internas (SKU, facturación, bodega)",
  "Garantías del proveedor ajenas a las políticas de esta tienda",
];

const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900";

function sectionLabel(type: string): string {
  return SECTION_REGISTRY.find((s) => s.type === type)?.label ?? type;
}

const PENDING_FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  slug: "Slug",
  meta_title: "Meta título",
  meta_desc: "Meta descripción",
  category: "Categoría",
};

export function AIProductWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [exiting, setExiting] = useState(false);

  // ── Paso 1 ───────────────────────────────────────────────────────────────
  const [supplierText, setSupplierText] = useState("");
  const [commercialGoal, setCommercialGoal] = useState("");
  const [tone, setTone] = useState<AIProductStudioTone>("directo");

  // ── Paso 2 ───────────────────────────────────────────────────────────────
  const [productMedia, setProductMedia] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [imagesUploading, setImagesUploading] = useState(false);
  // URLs subidas a R2 durante ESTA sesión del asistente — únicas candidatas a
  // limpieza si se cancela antes de aplicar. Nunca contiene nada que no haya
  // subido este mismo asistente (nunca imágenes de otros productos).
  const uploadedThisSessionRef = useRef<Set<string>>(new Set());
  const appliedRef = useRef(false);

  const trackedSetProductMedia: Dispatch<SetStateAction<string[]>> = useCallback((update) => {
    setProductMedia((prev) => {
      const next = typeof update === "function" ? (update as (p: string[]) => string[])(prev) : update;
      for (const url of next) {
        if (!prev.includes(url)) uploadedThisSessionRef.current.add(url);
      }
      return next;
    });
  }, []);

  function handleDeleteMedia(url: string) {
    setProductMedia((prev) => prev.filter((u) => u !== url));
    setImages((prev) => prev.filter((u) => u !== url));
    if (uploadedThisSessionRef.current.has(url)) {
      uploadedThisSessionRef.current.delete(url);
      // Best-effort: recién se subió en esta sesión y el usuario decidió
      // quitarla antes de aplicar nada — no queda ninguna referencia posible
      // en `products`, así que es seguro borrarla físicamente de R2 ahora
      // mismo en vez de esperar al cierre del asistente.
      void deleteProductImage(url);
    }
  }

  // ── Paso 3 ───────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState<AIProductDraft | null>(null);
  const [excludedSectionIds, setExcludedSectionIds] = useState<Set<string>>(new Set());
  const [editedCategory, setEditedCategory] = useState("");
  const [editedTags, setEditedTags] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);

  const includedSections = draft ? draft.product_sections.filter((s) => !excludedSectionIds.has(s.id)) : [];

  function toggleSection(id: string) {
    setExcludedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateDraftField<K extends keyof AIProductDraft>(key: K, value: AIProductDraft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  // ── Navegación entre pasos ──────────────────────────────────────────────

  function goToImages() {
    if (!supplierText.trim()) {
      toast.error("Pega el texto o ficha del proveedor antes de continuar.");
      return;
    }
    setStep(2);
  }

  function goToPreview() {
    if (imagesUploading) {
      toast.error("Espera a que terminen de subirse las imágenes.");
      return;
    }
    if (images.length === 0) {
      toast.error("Elige al menos una imagen para la galería antes de continuar.");
      return;
    }
    setGenerateError(null);

    const parsedInput = aiProductStudioInputSchema.safeParse({
      supplierText,
      selectedImages: images,
      commercialGoal: commercialGoal.trim() || undefined,
      tone,
    });
    if (!parsedInput.success) {
      setGenerateError(parsedInput.error.issues[0]?.message ?? "Revisa los datos ingresados.");
      return;
    }

    const generated = generateDemoDraft(parsedInput.data, new Date().toISOString());
    const parsedDraft = aiProductDraftSchema.safeParse(generated);
    if (!parsedDraft.success) {
      console.error("[ai-product-studio] borrador generado inválido:", parsedDraft.error);
      setGenerateError("El generador produjo un borrador inválido. Revisa la consola para más detalles.");
      return;
    }

    setDraft(parsedDraft.data);
    setExcludedSectionIds(new Set());
    setEditedCategory(parsedDraft.data.category ?? "");
    setEditedTags(parsedDraft.data.tags.join(", "));
    setStep(3);
  }

  // ── Cancelar: limpieza best-effort de imágenes huérfanas ─────────────────

  async function cleanupUploadedImages() {
    const toDelete = Array.from(uploadedThisSessionRef.current);
    if (toDelete.length === 0) return;
    await Promise.allSettled(toDelete.map((url) => deleteProductImage(url)));
  }

  async function handleExit() {
    if (appliedRef.current) {
      router.push("/admin/productos");
      return;
    }
    setExiting(true);
    try {
      await cleanupUploadedImages();
    } finally {
      router.push("/admin/productos");
    }
  }

  // ── Aplicar al borrador: puente a sessionStorage + navegar al form manual ─

  function handleApply() {
    if (!draft) return;
    const finalDraft: AIProductDraft = {
      ...draft,
      category: editedCategory.trim(),
      tags: editedTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      product_sections: includedSections,
    };

    writeAIStudioBridge({ draft: finalDraft, productMedia });
    appliedRef.current = true; // ninguna imagen subida en este asistente se borra: se llevan al formulario manual
    router.push("/admin/productos/nuevo");
  }

  // ── UI ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={handleExit}
          disabled={exiting}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {exiting ? "Cerrando…" : "Salir"}
        </button>

        <div className="ml-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-zinc-700" aria-hidden />
          <h1 className="text-sm font-bold text-zinc-900">Crear producto con IA</h1>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Modo demo
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className={clsx(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                  step === s
                    ? "bg-zinc-900 text-white"
                    : step > s
                      ? "bg-zinc-200 text-zinc-600"
                      : "bg-zinc-100 text-zinc-400"
                )}
              >
                {step > s ? <CheckCircle2 className="h-3.5 w-3.5" /> : s}
              </div>
              <span className={clsx("hidden text-xs sm:inline", step === s ? "font-semibold text-zinc-900" : "text-zinc-400")}>
                {STEP_LABELS[s]}
              </span>
              {s < 3 && <div className="h-px w-4 bg-zinc-200 sm:w-8" />}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">Modo demo:</span> este asistente genera un borrador localmente,
              sin conectarse a ningún proveedor de IA todavía. Nunca inventa materiales, medidas,
              certificaciones, garantías, stock, descuentos ni beneficios médicos.
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Pega aquí la ficha o descripción cruda del proveedor *
              </label>
              <textarea
                className={clsx(inputCls, "min-h-[220px] resize-y")}
                placeholder={
                  "Pega el texto tal como te lo pasa el proveedor.\nUna idea por línea funciona mejor. Usa \"- \" al inicio de una línea para viñetas/beneficios."
                }
                value={supplierText}
                onChange={(e) => setSupplierText(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Instrucción comercial (opcional)</label>
              <input
                className={inputCls}
                placeholder='Ej: "enfócalo en espacios pequeños y uso práctico"'
                value={commercialGoal}
                onChange={(e) => setCommercialGoal(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Tono</label>
              <div className="flex flex-wrap gap-2">
                {AI_PRODUCT_STUDIO_TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={clsx(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      tone === t
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                    )}
                  >
                    {AI_PRODUCT_STUDIO_TONE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <details className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-zinc-700">
                <Info className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                Qué información se ignora del texto del proveedor
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
              </summary>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-zinc-500">
                {IGNORED_TOPICS.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-zinc-400">
                Estos datos se detectan y descartan automáticamente antes de generar la ficha — nunca aparecen
                en la descripción, beneficios ni bloques del producto.
              </p>
            </details>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
              Sube o arrastra las imágenes del producto. Se cargan directamente a la biblioteca de medios —
              no necesitas volver al formulario manual para esto. Luego elige y ordena cuáles serán la
              galería pública; la primera será la portada y también alimentan los bloques generados.
            </div>

            <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-3.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Biblioteca de medios
                </h2>
              </div>
              <div className="p-5">
                <ProductMediaLibrary
                  images={productMedia}
                  onChange={trackedSetProductMedia}
                  findUsage={(url) => (images.includes(url) ? [{ id: "gallery", label: "Galería / candidatas para bloques" }] : [])}
                  onDelete={handleDeleteMedia}
                  onUploadingChange={setImagesUploading}
                />
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-3.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Galería y candidatas para bloques *
                </h2>
              </div>
              <div className="p-5">
                <ProductGallerySelector library={productMedia} gallery={images} onChange={setImages} />
              </div>
            </section>

            {generateError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {generateError}
              </div>
            )}
          </div>
        )}

        {step === 3 && draft && (
          <div className="flex flex-col gap-5">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">Modo demo · generado {new Date(draft.meta.generatedAt).toLocaleString("es-CL")}</span>
              {" — "}revisa y edita todo antes de aplicar. Nada se guarda ni se publica en este paso.
            </div>

            {draft.meta.detectedFacts.length > 0 && (
              <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Datos detectados del proveedor
                </h3>
                <ul className="list-inside list-disc space-y-0.5 text-xs text-emerald-800">
                  {draft.meta.detectedFacts.map((fact, i) => (
                    <li key={i}>{fact}</li>
                  ))}
                </ul>
              </section>
            )}

            {(draft.meta.pendingFields.length > 0 || draft.meta.claimsToAvoid.length > 0) && (
              <section className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                  Campos por confirmar
                </h3>
                {draft.meta.pendingFields.length > 0 && (
                  <p className="text-xs text-zinc-600">
                    {draft.meta.pendingFields.map((f) => PENDING_FIELD_LABELS[f] ?? f).join(", ")}
                  </p>
                )}
                {draft.meta.claimsToAvoid.length > 0 && (
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-zinc-500">
                    {draft.meta.claimsToAvoid.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {draft.meta.ignoredSupplierLines.length > 0 && (
              <details className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500">
                <summary className="cursor-pointer font-medium text-zinc-600">
                  {draft.meta.ignoredSupplierLines.length} línea(s) del texto se ignoraron (contacto, stock,
                  ofertas, etc.)
                </summary>
                <ul className="mt-2 list-inside list-disc space-y-0.5">
                  {draft.meta.ignoredSupplierLines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Nombre</label>
              <input
                className={clsx(
                  inputCls,
                  draft.meta.pendingFields.includes("name") && "border-amber-400 bg-amber-50"
                )}
                value={draft.name}
                onChange={(e) => updateDraftField("name", e.target.value)}
              />
              {draft.meta.pendingFields.includes("name") && (
                <p className="text-xs text-amber-600">
                  No se detectó un nombre confiable — reemplaza este texto antes de guardar el producto.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Slug</label>
              <input
                className={inputCls}
                value={draft.slug}
                placeholder="se-genera-a-partir-del-nombre"
                onChange={(e) => updateDraftField("slug", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Descripción (HTML simple)</label>
              <textarea
                className={clsx(inputCls, "min-h-[140px] resize-y font-mono text-xs")}
                value={draft.description}
                onChange={(e) => updateDraftField("description", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Categoría (por confirmar)</label>
                <input
                  className={clsx(inputCls, "border-amber-400 bg-amber-50")}
                  value={editedCategory}
                  placeholder="Por confirmar"
                  onChange={(e) => setEditedCategory(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Etiquetas (separadas por coma)</label>
                <input className={inputCls} value={editedTags} onChange={(e) => setEditedTags(e.target.value)} />
              </div>
            </div>

            <p className="text-xs text-zinc-400">
              Meta título y meta descripción se generaron pero el formulario manual todavía no tiene esos
              campos — ver AI_PRODUCT_STUDIO_PLAN.md. Meta título: <em>{draft.meta_title || "(vacío)"}</em>.
              Meta descripción: <em>{draft.meta_desc || "(vacío)"}</em>.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Imágenes que se aplicarán a la galería ({draft.images.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {draft.images.map((url, i) => (
                  <div key={url} className="relative h-14 w-14 overflow-hidden rounded-md border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute bottom-0 left-0 right-0 bg-zinc-900/70 py-0.5 text-center text-[8px] font-semibold uppercase text-white">
                        Portada
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">
                Bloques de la ficha ({includedSections.length} de {draft.product_sections.length} incluidos)
              </label>
              {draft.product_sections.length === 0 ? (
                <p className="text-xs text-zinc-400">
                  No se generó ningún bloque (sin viñetas detectadas en el texto e insuficientes imágenes).
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white">
                  {draft.product_sections.map((section) => {
                    const excluded = excludedSectionIds.has(section.id);
                    const heading =
                      "heading" in section.data && section.data.heading ? section.data.heading : sectionLabel(section.type);
                    return (
                      <label
                        key={section.id}
                        className={clsx(
                          "flex cursor-pointer items-start gap-2.5 px-3 py-2.5 text-sm",
                          excluded && "opacity-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                          checked={!excluded}
                          onChange={() => toggleSection(section.id)}
                        />
                        <span>
                          <span className="block font-medium text-zinc-900">
                            {sectionLabel(section.type)} — {heading}
                          </span>
                          {section.type === "benefits" && (
                            <span className="block text-xs text-zinc-500">
                              {section.data.items.length} tarjeta{section.data.items.length === 1 ? "" : "s"}:{" "}
                              {section.data.items.map((it) => it.title).join(", ")}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-zinc-200 bg-white px-4 py-3.5 sm:px-6">
        <div>
          {step > 1 && (
            <Button type="button" variant="secondary" onClick={() => setStep((s) => (s - 1) as Step)}>
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={handleExit} disabled={exiting}>
            <X className="h-4 w-4" />
            Cancelar
          </Button>
          {step === 1 && (
            <Button type="button" onClick={goToImages}>
              Siguiente
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {step === 2 && (
            <Button type="button" onClick={goToPreview} loading={imagesUploading}>
              <Sparkles className="h-4 w-4" />
              Generar borrador (demo)
            </Button>
          )}
          {step === 3 && (
            <Button type="button" onClick={handleApply}>
              Aplicar al borrador
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
