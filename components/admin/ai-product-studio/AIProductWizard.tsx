"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileText,
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
import {
  AI_PRODUCT_STUDIO_TONES,
  AI_PRODUCT_STUDIO_TONE_LABELS,
  aiProductDraftSchema,
  aiProductStudioInputSchema,
  type AIProductDraft,
  type AIProductStudioTone,
} from "@/lib/ai-product-studio/schema";
import { writeAIStudioBridge } from "@/lib/ai-product-studio/bridge";
import {
  validateCommercialData,
  type CommercialField,
  type CommercialFormInput,
} from "@/lib/ai-product-studio/commercialData";
import { SECTION_REGISTRY, type ProductSection } from "@/lib/product/sections/types";
import { VisualDirectionPanel } from "./VisualDirectionPanel";

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Información del proveedor",
  2: "Imágenes",
  3: "Vista previa",
};

const IGNORED_TOPICS = [
  "WhatsApp u otro contacto directo del proveedor",
  "Avisos para \"confirmar stock\" o \"confirmar inventario\"",
  "Ofertas, descuentos o promociones del proveedor",
  "Entregas o despachos a cargo de terceros (ej. \"entrega en 24 horas\")",
  "URLs externas (catálogos, redes del proveedor, etc.)",
  "Instrucciones administrativas internas (SKU, facturación, bodega)",
  "Garantías del proveedor o de Dropi ajenas a las políticas de esta tienda",
];

const GENERATE_TIMEOUT_MS = 60_000;

const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900";

function sectionLabel(type: string): string {
  return SECTION_REGISTRY.find((s) => s.type === type)?.label ?? type;
}

/** Mueve la URL en `index` al frente (nueva portada) — nunca quita ninguna imagen, solo reordena. */
function moveGalleryImageToFront(urls: string[], index: number): string[] {
  if (index <= 0 || index >= urls.length) return urls;
  const next = [...urls];
  const [picked] = next.splice(index, 1);
  next.unshift(picked);
  return next;
}

/**
 * Reemplaza `image_url` de una sección sin cambiar nada más de su `data`.
 * Los 4 tipos que puede producir el Estudio IA (benefits/usage/measurements/
 * versatility) siempre tienen `image_url` — el cast es seguro porque solo se
 * sobreescribe ese campo compartido, nunca se toca la forma del resto de
 * `data` (TypeScript no puede probar la correlación tipo/data a través de un
 * spread genérico sobre una unión discriminada, pero el chequeo `in` en
 * tiempo de ejecución sí la garantiza).
 */
function withSectionImageUrl(section: ProductSection, url: string): ProductSection {
  if (!("image_url" in section.data)) return section;
  return { ...section, data: { ...section.data, image_url: url } } as ProductSection;
}

const PENDING_FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  slug: "Slug",
  category: "Categoría",
};

export function AIProductWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [exiting, setExiting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Datos comerciales: precio, stock, costo y enlace Dropi. Nunca los genera
  // ni los toca la IA — el admin los completa acá antes de aplicar, para que
  // el formulario manual abra con la ficha lista de punta a punta.
  const [commercialForm, setCommercialForm] = useState<CommercialFormInput>({
    price: "",
    compareAtPrice: "",
    stock: "0",
    costPrice: "",
    dropiProductUrl: "",
  });
  const commercialValidation = validateCommercialData(commercialForm);

  // Nivel 3 — Mejora visual: URLs de imágenes generadas por IA y ya
  // aprobadas por el admin en esta sesión (aplicadas a una sección/portada o
  // agregadas a la biblioteca). Solo se usa para mostrar la insignia "Generada
  // con IA" — nunca cambia qué imagen se usa dónde, eso ya lo decidió el admin
  // al aprobarla.
  const [aiGeneratedImageUrls, setAiGeneratedImageUrls] = useState<Set<string>>(new Set());

  function markAsAIGenerated(url: string) {
    setAiGeneratedImageUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
  }

  /** "Usar en esta sección" / "Usar como portada" — `sectionId === "gallery"` mueve la imagen al frente de la galería; cualquier otro id es una sección real del borrador. */
  function handleApplyAIImageToSection(sectionId: string, url: string) {
    markAsAIGenerated(url);
    if (sectionId === "gallery") {
      setDraft((prev) =>
        prev ? { ...prev, galleryImageUrls: [url, ...prev.galleryImageUrls.filter((u) => u !== url)] } : prev
      );
      return;
    }
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            productSections: prev.productSections.map((s) => (s.id === sectionId ? withSectionImageUrl(s, url) : s)),
          }
        : prev
    );
  }

  /** "Agregar a biblioteca" — solo entra a `product_media`, nunca a la galería pública ni a ninguna sección automáticamente. */
  function handleAddAIImageToLibrary(url: string) {
    markAsAIGenerated(url);
    trackedSetProductMedia((prev) => (prev.includes(url) ? prev : [...prev, url]));
  }

  /**
   * Asigna una foto REAL del proveedor a una sección (o portada si
   * `sectionId === "gallery"`) — a diferencia de `handleApplyAIImageToSection`,
   * NUNCA marca la imagen como "Generada con IA". La usa el Plan visual tanto
   * para aplicar sus recomendaciones automáticas como para la elección manual
   * del admin ("Cambiar imagen").
   */
  function handleApplyRealImageToSection(sectionId: string, url: string) {
    if (sectionId === "gallery") {
      setDraft((prev) =>
        prev ? { ...prev, galleryImageUrls: [url, ...prev.galleryImageUrls.filter((u) => u !== url)] } : prev
      );
      return;
    }
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            productSections: prev.productSections.map((s) => (s.id === sectionId ? withSectionImageUrl(s, url) : s)),
          }
        : prev
    );
  }

  /** Reemplaza `draft.galleryImageUrls` completo (portada = primer elemento) — Plan visual, solo fotos reales. */
  function handleReorderGallery(urls: string[]) {
    setDraft((prev) => (prev ? { ...prev, galleryImageUrls: urls } : prev));
  }

  function commercialError(field: CommercialField): string | undefined {
    return commercialValidation.ok
      ? undefined
      : commercialValidation.errors.find((e) => e.field === field)?.message;
  }

  function updateCommercialField(field: keyof CommercialFormInput, value: string) {
    setCommercialForm((prev) => ({ ...prev, [field]: value }));
  }

  const includedSections = draft ? draft.productSections.filter((s) => !excludedSectionIds.has(s.id)) : [];

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

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

  async function goToPreview() {
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

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

    setGenerating(true);
    try {
      const res = await fetch("/api/admin/ai-product-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedInput.data),
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => ({}))) as { draft?: unknown; error?: string };

      if (!res.ok || !body.draft) {
        setGenerateError(body.error ?? "No se pudo generar el borrador. Intenta de nuevo.");
        return;
      }

      const parsedDraft = aiProductDraftSchema.safeParse(body.draft);
      if (!parsedDraft.success) {
        console.error("[ai-product-studio] borrador recibido inválido:", parsedDraft.error);
        setGenerateError("El servidor devolvió un borrador con formato inválido.");
        return;
      }

      setDraft(parsedDraft.data);
      setExcludedSectionIds(new Set());
      setEditedCategory(parsedDraft.data.category ?? "");
      setEditedTags(parsedDraft.data.tags.join(", "));
      setStep(3);
    } catch (err) {
      if (controller.signal.aborted) {
        setGenerateError("La generación tardó demasiado y se canceló. Intenta de nuevo.");
      } else {
        console.error("[ai-product-studio] error de red generando el borrador:", err);
        setGenerateError("No se pudo conectar con el servidor. Intenta de nuevo.");
      }
    } finally {
      clearTimeout(timeoutId);
      abortRef.current = null;
      setGenerating(false);
    }
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

  // ── Continuar a revisión: puente a sessionStorage + navegar al form manual ─
  // Esto NUNCA crea un producto — solo transporta el borrador ya generado
  // (nombre, slug, descripción, galería, biblioteca, secciones y datos
  // comerciales) hasta el formulario manual, donde el admin revisa todo y
  // recién ahí decide guardar. Si la escritura del puente falla (ej.
  // sessionStorage deshabilitado/lleno), no se navega — el admin se queda en
  // el asistente con un error claro en vez de llegar a un formulario vacío
  // sin saber por qué.

  function handleContinueToReview() {
    if (!draft || !commercialValidation.ok) return;
    const finalDraft: AIProductDraft = {
      ...draft,
      category: editedCategory.trim(),
      tags: editedTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      productSections: includedSections,
    };

    const wrote = writeAIStudioBridge({
      draft: finalDraft,
      productMedia,
      commercial: commercialValidation.data,
      aiGeneratedImageUrls: Array.from(aiGeneratedImageUrls),
    });
    if (!wrote) {
      toast.error("No se pudo preparar el borrador para continuar. Intenta de nuevo.");
      return;
    }
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
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
            Generación con IA
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
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
              <span className="font-semibold">Generación con IA:</span> revisa todo antes de aplicar y guardar.
              El modelo nunca inventa materiales, medidas, certificaciones, garantías, stock, descuentos ni
              beneficios médicos — si el texto no lo respalda, queda marcado como pendiente en vez de inventado.
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
                Estos datos se detectan y descartan automáticamente antes de generar la ficha (incluso antes de
                enviarse al modelo) — nunca aparecen en la descripción, beneficios ni bloques del producto.
              </p>
            </details>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
              Sube o arrastra las imágenes del producto. Se cargan directamente a la biblioteca de medios —
              no necesitas volver al formulario manual para esto. Luego elige y ordena cuáles serán la
              galería pública; la primera será la portada y también alimentan los bloques generados (hasta 6
              imágenes se envían al modelo).
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
                  badgeFor={(url) => (aiGeneratedImageUrls.has(url) ? "Generada con IA" : null)}
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
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
              <span className="font-semibold">
                Generación con IA{draft.meta.model ? ` (${draft.meta.model})` : ""} · {new Date(draft.meta.generatedAt).toLocaleString("es-CL")}
              </span>
              {" — "}revisa todo antes de aplicar y guardar. Nada se guarda ni se publica en este paso.
            </div>

            {draft.meta.warnings.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                {draft.meta.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {draft.detectedFacts.length > 0 && (
              <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Datos detectados del proveedor
                </h3>
                <ul className="space-y-1.5 text-xs text-emerald-800">
                  {draft.detectedFacts.map((fact, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      {fact.source === "supplier_image" ? (
                        <Eye className="mt-0.5 h-3 w-3 shrink-0" aria-label="Observación visual" />
                      ) : (
                        <FileText className="mt-0.5 h-3 w-3 shrink-0" aria-label="Texto del proveedor" />
                      )}
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span>{fact.claim}</span>
                        {fact.confidence === "needs_review" && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            Por confirmar
                          </span>
                        )}
                        {fact.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={fact.imageUrl}
                            alt="Imagen fuente"
                            title="Imagen fuente"
                            className="h-5 w-5 shrink-0 rounded border border-emerald-200 object-cover"
                          />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(draft.fieldsNeedingConfirmation.length > 0 || draft.claimsToAvoid.length > 0) && (
              <section className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                  Campos por confirmar y afirmaciones omitidas
                </h3>
                {draft.fieldsNeedingConfirmation.length > 0 && (
                  <p className="text-xs text-zinc-600">
                    {draft.fieldsNeedingConfirmation.map((f) => PENDING_FIELD_LABELS[f] ?? f).join(", ")}
                  </p>
                )}
                {draft.claimsToAvoid.length > 0 && (
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-zinc-500">
                    {draft.claimsToAvoid.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {draft.ignoredSupplierLines.length > 0 && (
              <details className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500">
                <summary className="cursor-pointer font-medium text-zinc-600">
                  {draft.ignoredSupplierLines.length} línea(s) del texto se ignoraron (contacto, stock, ofertas,
                  etc.)
                </summary>
                <ul className="mt-2 list-inside list-disc space-y-0.5">
                  {draft.ignoredSupplierLines.map((l, i) => (
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
                  draft.fieldsNeedingConfirmation.includes("name") && "border-amber-400 bg-amber-50"
                )}
                value={draft.name}
                onChange={(e) => updateDraftField("name", e.target.value)}
              />
              {draft.fieldsNeedingConfirmation.includes("name") && (
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
                value={draft.descriptionHtml}
                onChange={(e) => updateDraftField("descriptionHtml", e.target.value)}
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

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Imágenes que se aplicarán a la galería ({draft.galleryImageUrls.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {draft.galleryImageUrls.map((url, i) => (
                  <div key={url} className="group relative h-14 w-14 overflow-hidden rounded-md border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {i === 0 ? (
                      <span className="absolute bottom-0 left-0 right-0 bg-zinc-900/70 py-0.5 text-center text-[8px] font-semibold uppercase text-white">
                        Portada
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateDraftField("galleryImageUrls", moveGalleryImageToFront(draft.galleryImageUrls, i))}
                        className="absolute inset-x-0 bottom-0 bg-zinc-900/70 py-0.5 text-center text-[8px] font-semibold uppercase text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                      >
                        Usar como portada
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {draft.meta.warnings.some((w) => w.toLowerCase().includes("portada")) && (
                <p className="text-xs text-amber-600">
                  Se ajustó la portada automáticamente para evitar una imagen técnica de medidas. Pasa el mouse
                  sobre cualquier miniatura y elige &quot;Usar como portada&quot; para cambiarla.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">
                Bloques de la ficha ({includedSections.length} de {draft.productSections.length} incluidos)
              </label>
              {draft.productSections.length === 0 ? (
                <p className="text-xs text-zinc-400">
                  No se generó ningún bloque (sin evidencia suficiente en el texto/imágenes).
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white">
                  {draft.productSections.map((section) => {
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

            <VisualDirectionPanel
              draft={draft}
              referencePhotos={images}
              onReorderGallery={handleReorderGallery}
              onApplyRealImageToSection={handleApplyRealImageToSection}
              onApplyAIImageToSection={handleApplyAIImageToSection}
              onAddAIImageToLibrary={handleAddAIImageToLibrary}
            />

            <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-3.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Datos comerciales
                </h2>
              </div>
              <div className="flex flex-col gap-4 p-5">
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                  Precio, stock, costo y enlace Dropi son datos de negocio — la IA nunca los genera ni los
                  modifica. Complétalos para que el formulario abra listo, o déjalos pendientes y termínalos
                  ahí directamente.
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700">Precio de venta CLP *</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="49990"
                      className={clsx(inputCls, commercialError("price") && "border-red-400 bg-red-50")}
                      value={commercialForm.price}
                      onChange={(e) => updateCommercialField("price", e.target.value)}
                    />
                    {commercialError("price") && (
                      <p className="text-xs text-red-600">{commercialError("price")}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700">Precio comparativo (opcional)</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="79990"
                      className={clsx(
                        inputCls,
                        commercialError("compareAtPrice") && "border-red-400 bg-red-50"
                      )}
                      value={commercialForm.compareAtPrice}
                      onChange={(e) => updateCommercialField("compareAtPrice", e.target.value)}
                    />
                    {commercialError("compareAtPrice") && (
                      <p className="text-xs text-red-600">{commercialError("compareAtPrice")}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700">Stock *</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="0"
                      className={clsx(inputCls, commercialError("stock") && "border-red-400 bg-red-50")}
                      value={commercialForm.stock}
                      onChange={(e) => updateCommercialField("stock", e.target.value)}
                    />
                    {commercialError("stock") && (
                      <p className="text-xs text-red-600">{commercialError("stock")}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700">
                      Precio costo (opcional, interno)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="25000"
                      className={clsx(inputCls, commercialError("costPrice") && "border-red-400 bg-red-50")}
                      value={commercialForm.costPrice}
                      onChange={(e) => updateCommercialField("costPrice", e.target.value)}
                    />
                    {commercialError("costPrice") && (
                      <p className="text-xs text-red-600">{commercialError("costPrice")}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">
                    URL del producto en Dropi (opcional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://app.dropi.cl/..."
                    className={clsx(
                      inputCls,
                      commercialError("dropiProductUrl") && "border-red-400 bg-red-50"
                    )}
                    value={commercialForm.dropiProductUrl}
                    onChange={(e) => updateCommercialField("dropiProductUrl", e.target.value)}
                  />
                  {commercialError("dropiProductUrl") ? (
                    <p className="text-xs text-red-600">{commercialError("dropiProductUrl")}</p>
                  ) : (
                    <p className="text-xs text-zinc-400">
                      Solo lo ve el admin, nunca aparece en la tienda pública.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-zinc-200 bg-white px-4 py-3.5 sm:px-6">
        <div>
          {step > 1 && (
            <Button type="button" variant="secondary" onClick={() => setStep((s) => (s - 1) as Step)} disabled={generating}>
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={handleExit} disabled={exiting || generating}>
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
            <Button type="button" onClick={goToPreview} loading={generating || imagesUploading}>
              <Sparkles className="h-4 w-4" />
              {generating ? "Generando con IA…" : "Generar con IA"}
            </Button>
          )}
          {step === 3 && (
            <div className="flex items-center gap-2">
              {!commercialValidation.ok && (
                <p className="max-w-[220px] text-right text-xs text-red-600">
                  {commercialValidation.errors[0]?.message}
                </p>
              )}
              <Button type="button" onClick={handleContinueToReview} disabled={!commercialValidation.ok}>
                Continuar a revisión
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
