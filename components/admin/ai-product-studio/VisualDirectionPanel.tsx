"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ImageOff,
  Layers,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { clsx } from "clsx";

import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import type { AIProductDraft } from "@/lib/ai-product-studio/schema";
import { AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT } from "@/lib/ai-product-studio/visualEnhancement/types";
import {
  GALLERY_EXCLUDED_CATEGORIES,
  GENERATION_INTENT_LABELS,
  IMAGE_CATEGORY_LABELS,
  type ImageCategory,
  type SectionImagePlan,
  type VisualDirectionPlan,
} from "@/lib/ai-product-studio/visualEnhancement/imageDirectionPlan";

/** Estimado aproximado (gpt-image-1, calidad media, 1024x1024) — la tarifa real la fija OpenAI y puede cambiar; se muestra solo como referencia antes de gastar cuota. */
const APPROX_COST_USD_PER_IMAGE = "US$0,04";

interface VisualDirectionPanelProps {
  draft: AIProductDraft;
  /** Fotos reales del proveedor elegidas en el Paso 2 — nunca imágenes IA. */
  referencePhotos: string[];
  /** Reemplaza `draft.galleryImageUrls` completo (portada = primer elemento) — solo con fotos reales, nunca con IA sin aprobar. */
  onReorderGallery: (urls: string[]) => void;
  /** Asigna una foto REAL a una sección (o portada si `sectionId === "gallery"`) — nunca marca la imagen como generada por IA. */
  onApplyRealImageToSection: (sectionId: string, imageUrl: string) => void;
  /** Aplica una imagen YA GENERADA Y APROBADA por IA a una sección/portada — sí la marca como "Generada con IA". */
  onApplyAIImageToSection: (sectionId: string, imageUrl: string) => void;
  /** "Agregar a biblioteca" para una imagen IA aprobada — nunca entra a la galería pública automáticamente. */
  onAddAIImageToLibrary: (imageUrl: string) => void;
}

interface PendingResult {
  dataUrl: string;
  prompt: string;
  referenceImageUrl: string;
}

const CATEGORY_BADGE_STYLE: Record<ImageCategory, string> = {
  clean_cover: "bg-emerald-100 text-emerald-700",
  in_use: "bg-emerald-100 text-emerald-700",
  kit_accessories: "bg-sky-100 text-sky-700",
  detail: "bg-sky-100 text-sky-700",
  measurements: "bg-violet-100 text-violet-700",
  promotional_graphic: "bg-red-100 text-red-700",
  collage: "bg-red-100 text-red-700",
  low_quality: "bg-zinc-200 text-zinc-600",
};

function CategoryBadge({ category }: { category: ImageCategory }) {
  return (
    <span className={clsx("rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", CATEGORY_BADGE_STYLE[category])}>
      {IMAGE_CATEGORY_LABELS[category]}
    </span>
  );
}

export function VisualDirectionPanel({
  draft,
  referencePhotos,
  onReorderGallery,
  onApplyRealImageToSection,
  onApplyAIImageToSection,
  onAddAIImageToLibrary,
}: VisualDirectionPanelProps) {
  const [plan, setPlan] = useState<VisualDirectionPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [pickerForSection, setPickerForSection] = useState<string | null>(null);

  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingResults, setPendingResults] = useState<Record<string, PendingResult>>({});
  const [approvedSectionIds, setApprovedSectionIds] = useState<Set<string>>(new Set());
  const [generatedCount, setGeneratedCount] = useState(0);
  const limitReached = generatedCount >= AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT;

  async function runPlan() {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await fetch("/api/admin/ai-product-studio/visual-direction-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, referencePhotos }),
      });
      const data = (await res.json().catch(() => ({}))) as { plan?: VisualDirectionPlan; error?: string };
      if (!res.ok || !data.plan) {
        setPlanError(data.error ?? "No se pudo planificar la ficha.");
        return;
      }
      setPlan(data.plan);
      const initialPrompts: Record<string, string> = {};
      for (const s of data.plan.sections) {
        if (s.generationProposal) initialPrompts[s.sectionId] = s.generationProposal.promptDraft;
      }
      setPrompts(initialPrompts);

      // Auto-aplica la galería y las asignaciones de FOTOS REALES recomendadas —
      // el admin puede revertir/reordenar después. Las propuestas de generación
      // NUNCA se auto-aplican: requieren clic explícito en "Generar esta imagen"
      // y luego aprobación.
      if (data.plan.gallery.recommendedOrder.length > 0) {
        onReorderGallery(data.plan.gallery.recommendedOrder);
      }
      for (const s of data.plan.sections) {
        if (s.sectionId === "gallery" || !s.assignedImageUrl) continue;
        onApplyRealImageToSection(s.sectionId, s.assignedImageUrl);
      }
    } catch {
      setPlanError("No se pudo conectar con el servidor.");
    } finally {
      setPlanLoading(false);
    }
  }

  function reorderCoverTo(url: string) {
    if (!plan) return;
    const next = [url, ...plan.gallery.recommendedOrder.filter((u) => u !== url)];
    setPlan({ ...plan, gallery: { ...plan.gallery, recommendedOrder: next, coverUrl: url } });
    onReorderGallery(next);
  }

  function includeDiscardedInGallery(url: string) {
    if (!plan) return;
    if (plan.gallery.recommendedOrder.includes(url)) return;
    const next = [...plan.gallery.recommendedOrder, url];
    setPlan({ ...plan, gallery: { ...plan.gallery, recommendedOrder: next } });
    onReorderGallery(next);
  }

  function pickImageForSection(section: SectionImagePlan, url: string) {
    onApplyRealImageToSection(section.sectionId, url);
    setPlan((prev) =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map((s) =>
              s.sectionId === section.sectionId
                ? { ...s, assignedImageUrl: url, assignmentReason: "Elegida manualmente por el admin.", needsGeneration: false }
                : s
            ),
          }
        : prev
    );
    setPickerForSection(null);
  }

  async function handleGenerate(section: SectionImagePlan) {
    const proposal = section.generationProposal;
    if (!proposal || limitReached) return;
    const prompt = (prompts[section.sectionId] ?? proposal.promptDraft).trim();
    if (!prompt) {
      toast.error("Escribe un prompt antes de generar.");
      return;
    }
    setConfirmingId(null);
    setGeneratingId(section.sectionId);
    try {
      const res = await fetch("/api/admin/ai-product-studio/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, referenceImageUrl: proposal.referenceImageUrl, alreadyGeneratedCount: generatedCount }),
      });
      const data = (await res.json().catch(() => ({}))) as { dataUrl?: string; error?: string };
      if (!res.ok || !data.dataUrl) {
        toast.error(data.error ?? "No se pudo generar la imagen.");
        return;
      }
      setGeneratedCount((c) => c + 1);
      setPendingResults((prev) => ({
        ...prev,
        [section.sectionId]: { dataUrl: data.dataUrl!, prompt, referenceImageUrl: proposal.referenceImageUrl },
      }));
    } catch {
      toast.error("Error de conexión al generar la imagen.");
    } finally {
      setGeneratingId(null);
    }
  }

  async function approveAndGet(section: SectionImagePlan, pending: PendingResult): Promise<string | null> {
    try {
      const res = await fetch("/api/admin/ai-product-studio/approve-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl: pending.dataUrl,
          sectionId: section.sectionId,
          sectionType: section.sectionType,
          prompt: pending.prompt,
          referenceImageUrl: pending.referenceImageUrl,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { image?: { url: string }; error?: string };
      if (!res.ok || !data.image) {
        toast.error(data.error ?? "No se pudo guardar la imagen aprobada.");
        return null;
      }
      return data.image.url;
    } catch {
      toast.error("Error de conexión al guardar la imagen.");
      return null;
    }
  }

  function clearPending(sectionId: string) {
    setPendingResults((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  }

  async function handleUseInSection(section: SectionImagePlan, pending: PendingResult) {
    const url = await approveAndGet(section, pending);
    if (!url) return;
    onApplyAIImageToSection(section.sectionId, url);
    setApprovedSectionIds((prev) => new Set(prev).add(section.sectionId));
    setPlan((prev) =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map((s) =>
              s.sectionId === section.sectionId ? { ...s, assignedImageUrl: url, needsGeneration: false } : s
            ),
          }
        : prev
    );
    clearPending(section.sectionId);
    toast.success(section.sectionId === "gallery" ? "Imagen aplicada como portada." : "Imagen aplicada a la sección.");
  }

  async function handleAddToLibrary(section: SectionImagePlan, pending: PendingResult) {
    const url = await approveAndGet(section, pending);
    if (!url) return;
    onAddAIImageToLibrary(url);
    setApprovedSectionIds((prev) => new Set(prev).add(section.sectionId));
    clearPending(section.sectionId);
    toast.success("Imagen agregada a la biblioteca.");
  }

  const nonExcludedReferencePhotos = referencePhotos.filter(
    (url) => !plan || !GALLERY_EXCLUDED_CATEGORIES.has(plan.classifications.find((c) => c.url === url)?.category ?? "detail")
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-violet-600" aria-hidden />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Plan visual de tu ficha</h2>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5">
        <p className="text-xs text-zinc-500">
          Clasifica las fotos reales del proveedor, arma la galería y decide qué imagen (real o a generar) le
          corresponde a cada sección — nunca repite una imagen entre bloques ni usa una gráfica promocional o un
          diagrama de medidas como portada.
        </p>

        {!plan && (
          <Button type="button" variant="secondary" onClick={runPlan} loading={planLoading} className="w-fit">
            <Sparkles className="h-4 w-4" />
            {planLoading ? "Analizando…" : "Analizar ficha visualmente"}
          </Button>
        )}

        {planError && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {planError}
          </div>
        )}

        {plan && (
          <div className="flex flex-col gap-6">
            {plan.warnings.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                {plan.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Galería recomendada + portada ── */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">
                Galería recomendada ({plan.gallery.recommendedOrder.length})
              </label>
              {plan.gallery.coverUrl ? (
                <p className="text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-700">Portada recomendada:</span> {plan.gallery.coverReason}
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  Portada por confirmar — ninguna foto es lo bastante limpia o de uso real. Genera una imagen para
                  la galería más abajo o elige portada a mano.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {plan.gallery.recommendedOrder.map((url, i) => {
                  const cat = plan.classifications.find((c) => c.url === url)?.category ?? "detail";
                  return (
                    <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-md border border-zinc-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <span className="absolute left-0.5 top-0.5">
                        <CategoryBadge category={cat} />
                      </span>
                      {i === 0 ? (
                        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-zinc-900/75 py-0.5 text-[8px] font-semibold uppercase text-white">
                          <Star className="h-2.5 w-2.5" aria-hidden /> Portada
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => reorderCoverTo(url)}
                          className="absolute inset-x-0 bottom-0 hidden bg-zinc-900/75 py-0.5 text-center text-[8px] font-semibold uppercase text-white group-hover:block"
                        >
                          Usar como portada
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Imágenes descartadas ── */}
            {plan.gallery.discarded.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">
                  Imágenes descartadas ({plan.gallery.discarded.length})
                </label>
                <div className="flex flex-col gap-2">
                  {plan.gallery.discarded.map((d) => (
                    <div key={d.url} className="flex items-center gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <CategoryBadge category={d.category} />
                        <p className="mt-0.5 truncate text-xs text-zinc-500">{d.reason}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => includeDiscardedInGallery(d.url)}
                        className="shrink-0 text-[11px] font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-800"
                      >
                        Incluir de todas formas
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Mapa de secciones ── */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">Secciones → imagen asignada</label>
              <div className="flex flex-col divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                {plan.sections.map((section) => {
                  const pending = pendingResults[section.sectionId];
                  const approved = approvedSectionIds.has(section.sectionId);
                  return (
                    <div key={section.sectionId} className="flex flex-col gap-2 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                          {section.assignedImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={section.assignedImageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-zinc-300">
                              <ImageOff className="h-4 w-4" aria-hidden />
                            </div>
                          )}
                          {approved && (
                            <span className="absolute inset-x-0 bottom-0 bg-violet-600/90 py-[1px] text-center text-[7px] font-bold uppercase text-white">
                              IA
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900">{section.sectionLabel}</p>
                          {section.assignedImageUrl ? (
                            <p className="truncate text-xs text-zinc-500">{section.assignmentReason}</p>
                          ) : (
                            <p className="text-xs font-medium text-amber-600">
                              Esta sección necesita un recurso visual complementario
                            </p>
                          )}
                        </div>
                        {section.assignedImageUrl && section.sectionType !== "measurements" && (
                          <button
                            type="button"
                            onClick={() => setPickerForSection(pickerForSection === section.sectionId ? null : section.sectionId)}
                            className="shrink-0 text-[11px] font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-800"
                          >
                            Cambiar imagen
                          </button>
                        )}
                      </div>

                      {pickerForSection === section.sectionId && (
                        <div className="flex flex-wrap gap-1.5 pl-[60px]">
                          {nonExcludedReferencePhotos.map((url) => (
                            <button
                              key={url}
                              type="button"
                              onClick={() => pickImageForSection(section, url)}
                              className="h-10 w-10 overflow-hidden rounded border border-zinc-200 hover:border-zinc-900"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}

                      {!section.assignedImageUrl && section.generationProposal && (
                        <div className="flex flex-col gap-2 pl-[60px]">
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={section.generationProposal.referenceImageUrl}
                              alt="Foto real de referencia"
                              className="h-12 w-12 shrink-0 rounded-md border border-zinc-200 object-cover"
                            />
                            <div className="text-[11px] text-zinc-500">
                              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">
                                {GENERATION_INTENT_LABELS[section.generationProposal.intent]}
                              </span>{" "}
                              {section.generationProposal.persuasiveGoal}
                            </div>
                          </div>

                          {section.generationProposal.risks.length > 0 && (
                            <ul className="flex flex-col gap-0.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                              {section.generationProposal.risks.map((r, i) => (
                                <li key={i}>• {r}</li>
                              ))}
                            </ul>
                          )}

                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-zinc-700">Prompt (editable)</span>
                            <textarea
                              className="min-h-[64px] w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900"
                              value={prompts[section.sectionId] ?? ""}
                              onChange={(e) => setPrompts((prev) => ({ ...prev, [section.sectionId]: e.target.value }))}
                              disabled={generatingId === section.sectionId}
                            />
                          </label>

                          {!pending ? (
                            <div className="flex flex-col items-start gap-1.5">
                              {confirmingId === section.sectionId ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-zinc-600">
                                    ¿Generar? Costo aproximado {APPROX_COST_USD_PER_IMAGE} (según tarifa de OpenAI).
                                  </span>
                                  <Button type="button" size="sm" onClick={() => handleGenerate(section)}>
                                    Confirmar
                                  </Button>
                                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingId(null)}>
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={limitReached}
                                  loading={generatingId === section.sectionId}
                                  onClick={() => setConfirmingId(section.sectionId)}
                                >
                                  <Wand2 className="h-3.5 w-3.5" />
                                  {generatingId === section.sectionId ? "Generando…" : "Generar esta imagen"}
                                </Button>
                              )}
                              {limitReached && (
                                <span className="text-[11px] text-amber-600">
                                  Se alcanzó el máximo de {AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT} imágenes IA para esta ficha.
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={pending.dataUrl}
                                alt="Resultado generado por IA"
                                className="h-20 w-20 shrink-0 rounded-md border border-violet-300 object-cover"
                              />
                              <div className="flex flex-col gap-1.5">
                                <span className="w-fit rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                                  Generada con IA
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  <Button type="button" size="sm" onClick={() => handleUseInSection(section, pending)}>
                                    <Check className="h-3.5 w-3.5" />
                                    {section.sectionId === "gallery" ? "Usar como portada" : "Usar en esta sección"}
                                  </Button>
                                  <Button type="button" size="sm" variant="secondary" onClick={() => handleAddToLibrary(section, pending)}>
                                    Agregar a biblioteca
                                  </Button>
                                  <Button type="button" size="sm" variant="ghost" onClick={() => clearPending(section.sectionId)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Descartar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {!section.assignedImageUrl && !section.generationProposal && section.sectionType === "measurements" && (
                        <p className="pl-[60px] text-[11px] text-zinc-400">
                          Las medidas nunca se generan con IA — solo una foto real con cotas confirmadas.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={runPlan} loading={planLoading}>
                {planLoading ? "Analizando…" : "Volver a analizar"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowMobilePreview((v) => !v)}>
                <Smartphone className="h-3.5 w-3.5" />
                {showMobilePreview ? "Ocultar vista previa móvil" : "Ver vista previa móvil"}
              </Button>
            </div>

            {showMobilePreview && <MobilePreview draft={draft} />}
          </div>
        )}
      </div>
    </section>
  );
}

function MobilePreview({ draft }: { draft: AIProductDraft }) {
  const cover = draft.galleryImageUrls[0];
  return (
    <div className="flex justify-center rounded-xl bg-zinc-100 p-5">
      <div className="w-[280px] overflow-hidden rounded-[1.75rem] border-4 border-zinc-800 bg-white shadow-lg">
        <div className="relative aspect-square w-full bg-zinc-100">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300">
              <ImageOff className="h-8 w-8" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto p-2">
          {draft.galleryImageUrls.slice(1, 6).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
          ))}
        </div>
        <div className="px-3 pb-1">
          <p className="line-clamp-2 text-sm font-bold text-zinc-900">{draft.name}</p>
        </div>
        <div className="flex flex-col gap-2 px-3 pb-4 pt-1">
          {draft.productSections.map((s) => {
            const url = "image_url" in s.data ? s.data.image_url : "";
            const heading = "heading" in s.data && s.data.heading ? s.data.heading : s.type;
            return (
              <div key={s.id} className="flex items-center gap-2 rounded-md border border-zinc-100 p-1.5">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-zinc-100">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-300">
                      <X className="h-3 w-3" aria-hidden />
                    </div>
                  )}
                </div>
                <span className="truncate text-[11px] font-medium text-zinc-600">{heading}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
