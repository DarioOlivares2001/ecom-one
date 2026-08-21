"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  FolderPlus,
  ImageOff,
  LayoutGrid,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { clsx } from "clsx";

import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import type { AIProductDraft } from "@/lib/ai-product-studio/schema";
import {
  AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT,
  GENERATIVE_VISUAL_ACTIONS,
  VISUAL_SUGGESTION_ACTION_LABELS,
  type VisualAudit,
  type VisualSuggestion,
} from "@/lib/ai-product-studio/visualEnhancement/types";

/** Estimado aproximado (gpt-image-1, calidad media, 1024x1024) — la tarifa real la fija OpenAI y puede cambiar; se muestra solo como referencia antes de gastar cuota. */
const APPROX_COST_USD_PER_IMAGE = "US$0,04";

interface VisualEnhancementPanelProps {
  draft: AIProductDraft;
  /** Fotos reales del proveedor elegidas en el Paso 2 — nunca imágenes IA. */
  referencePhotos: string[];
  /**
   * "Usar en esta sección" / "Usar como portada": `sectionId === "gallery"`
   * significa portada/galería principal, cualquier otro valor es un
   * `productSections[].id` real. El padre decide qué mutar.
   */
  onApplyToSection: (sectionId: string, imageUrl: string) => void;
  /** "Agregar a biblioteca": solo entra a `product_media`, nunca a la galería pública automáticamente. */
  onAddToLibrary: (imageUrl: string) => void;
}

interface PendingResult {
  suggestionId: string;
  dataUrl: string;
  prompt: string;
  referenceImageUrl: string;
}

const ACTION_ICON: Record<VisualSuggestion["action"], typeof Camera> = {
  use_supplier_photo: Camera,
  suggest_lifestyle: Sparkles,
  suggest_usage: Wand2,
  suggest_context: LayoutGrid,
  no_image_needed: ImageOff,
};

export function VisualEnhancementPanel({
  draft,
  referencePhotos,
  onApplyToSection,
  onAddToLibrary,
}: VisualEnhancementPanelProps) {
  const [audit, setAudit] = useState<VisualAudit | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingResults, setPendingResults] = useState<Record<string, PendingResult>>({});
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [generatedCount, setGeneratedCount] = useState(0);

  const sectionCount = draft.productSections.length;
  const photoCount = referencePhotos.length;
  const limitReached = generatedCount >= AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT;

  async function runAudit() {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await fetch("/api/admin/ai-product-studio/visual-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, referencePhotos }),
      });
      const data = (await res.json().catch(() => ({}))) as { audit?: VisualAudit; error?: string };
      if (!res.ok || !data.audit) {
        setAuditError(data.error ?? "No se pudo analizar la ficha.");
        return;
      }
      setAudit(data.audit);
      const initialPrompts: Record<string, string> = {};
      for (const s of data.audit.suggestions) {
        if (s.promptDraft) initialPrompts[s.id] = s.promptDraft;
      }
      setPrompts(initialPrompts);
    } catch {
      setAuditError("No se pudo conectar con el servidor.");
    } finally {
      setAuditLoading(false);
    }
  }

  async function handleGenerate(s: VisualSuggestion) {
    if (!s.referenceImageUrl || limitReached) return;
    const prompt = (prompts[s.id] ?? s.promptDraft ?? "").trim();
    if (!prompt) {
      toast.error("Escribe un prompt antes de generar.");
      return;
    }
    setConfirmingId(null);
    setGeneratingId(s.id);
    try {
      const res = await fetch("/api/admin/ai-product-studio/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          referenceImageUrl: s.referenceImageUrl,
          alreadyGeneratedCount: generatedCount,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { dataUrl?: string; error?: string };
      if (!res.ok || !data.dataUrl) {
        toast.error(data.error ?? "No se pudo generar la imagen.");
        return;
      }
      setGeneratedCount((c) => c + 1);
      setPendingResults((prev) => ({
        ...prev,
        [s.id]: { suggestionId: s.id, dataUrl: data.dataUrl!, prompt, referenceImageUrl: s.referenceImageUrl! },
      }));
    } catch {
      toast.error("Error de conexión al generar la imagen.");
    } finally {
      setGeneratingId(null);
    }
  }

  async function approveAndGet(s: VisualSuggestion, pending: PendingResult): Promise<string | null> {
    try {
      const res = await fetch("/api/admin/ai-product-studio/approve-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl: pending.dataUrl,
          suggestionId: s.id,
          sectionId: s.sectionId,
          sectionType: s.sectionType,
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

  async function handleUseInSection(s: VisualSuggestion, pending: PendingResult) {
    const url = await approveAndGet(s, pending);
    if (!url) return;
    onApplyToSection(s.sectionId, url);
    setAppliedIds((prev) => new Set(prev).add(s.id));
    setPendingResults((prev) => {
      const next = { ...prev };
      delete next[s.id];
      return next;
    });
    toast.success(s.sectionId === "gallery" ? "Imagen aplicada como portada." : "Imagen aplicada a la sección.");
  }

  async function handleAddToLibrary(s: VisualSuggestion, pending: PendingResult) {
    const url = await approveAndGet(s, pending);
    if (!url) return;
    onAddToLibrary(url);
    setAppliedIds((prev) => new Set(prev).add(s.id));
    setPendingResults((prev) => {
      const next = { ...prev };
      delete next[s.id];
      return next;
    });
    toast.success("Imagen agregada a la biblioteca.");
  }

  function handleDiscard(suggestionId: string) {
    setPendingResults((prev) => {
      const next = { ...prev };
      delete next[suggestionId];
      return next;
    });
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" aria-hidden />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Mejorar ficha con IA</h2>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <p className="text-xs text-zinc-500">
          Analiza la ficha y las fotos reales del proveedor para sugerir imágenes complementarias por sección.
          Nada se genera ni se guarda automáticamente — cada imagen se revisa y aprueba a mano.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1">
            <Camera className="h-3.5 w-3.5" aria-hidden />
            {photoCount} foto{photoCount === 1 ? "" : "s"} real{photoCount === 1 ? "" : "es"} disponible
            {photoCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1">
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            {sectionCount} sección{sectionCount === 1 ? "" : "es"} en la ficha
          </span>
        </div>

        {!audit && (
          <Button type="button" variant="secondary" onClick={runAudit} loading={auditLoading} className="w-fit">
            <Sparkles className="h-4 w-4" />
            {auditLoading ? "Analizando…" : "Analizar oportunidades visuales"}
          </Button>
        )}

        {auditError && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {auditError}
          </div>
        )}

        {audit && (
          <div className="flex flex-col gap-3">
            {audit.warnings.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                {audit.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{audit.suggestions.length} oportunidad(es) detectada(s)</span>
              <span className={clsx(limitReached && "font-semibold text-amber-600")}>
                {generatedCount} / {AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT} imágenes IA generadas en esta ficha
              </span>
            </div>

            <div className="flex flex-col divide-y divide-zinc-100 rounded-lg border border-zinc-200">
              {audit.suggestions.map((s) => {
                const Icon = ACTION_ICON[s.action];
                const isGenerative = GENERATIVE_VISUAL_ACTIONS.has(s.action);
                const expanded = expandedId === s.id;
                const pending = pendingResults[s.id];
                const applied = appliedIds.has(s.id);

                return (
                  <div key={s.id} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : s.id)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-900">{s.sectionLabel}</span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                            {VISUAL_SUGGESTION_ACTION_LABELS[s.action]}
                          </span>
                          {applied && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Aplicada
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">{s.persuasiveGoal}</span>
                      </span>
                      <ChevronDown
                        className={clsx("h-4 w-4 shrink-0 text-zinc-400 transition-transform", expanded && "rotate-180")}
                        aria-hidden
                      />
                    </button>

                    {expanded && (
                      <div className="mt-3 flex flex-col gap-3 pl-11">
                        {s.risks.length > 0 && (
                          <ul className="flex flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            {s.risks.map((r, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                                {r}
                              </li>
                            ))}
                          </ul>
                        )}

                        {!isGenerative ? (
                          <p className="text-xs text-zinc-400">
                            {s.action === "use_supplier_photo"
                              ? "No se genera nada: se usa directamente la foto real del proveedor."
                              : "No hace falta agregar ninguna imagen a esta sección."}
                          </p>
                        ) : (
                          <>
                            {s.referenceImageUrl && (
                              <div className="flex items-center gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={s.referenceImageUrl}
                                  alt="Foto real de referencia"
                                  className="h-14 w-14 shrink-0 rounded-md border border-zinc-200 object-cover"
                                />
                                <span className="text-[11px] text-zinc-400">Foto real usada como referencia</span>
                              </div>
                            )}

                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-zinc-700">Prompt (editable)</span>
                              <textarea
                                className="min-h-[70px] w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900"
                                value={prompts[s.id] ?? ""}
                                onChange={(e) => setPrompts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                disabled={generatingId === s.id}
                              />
                            </label>

                            {!pending ? (
                              <div className="flex flex-col items-start gap-1.5">
                                {confirmingId === s.id ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-zinc-600">
                                      ¿Generar? Costo aproximado {APPROX_COST_USD_PER_IMAGE} (según tarifa de OpenAI).
                                    </span>
                                    <Button type="button" size="sm" onClick={() => handleGenerate(s)}>
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
                                    loading={generatingId === s.id}
                                    onClick={() => setConfirmingId(s.id)}
                                  >
                                    <Wand2 className="h-3.5 w-3.5" />
                                    {generatingId === s.id ? "Generando…" : "Generar imagen"}
                                  </Button>
                                )}
                                {limitReached && (
                                  <span className="text-[11px] text-amber-600">
                                    Se alcanzó el máximo de {AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT} imágenes IA para esta ficha.
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-start gap-3">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={pending.dataUrl}
                                    alt="Resultado generado por IA"
                                    className="h-24 w-24 shrink-0 rounded-md border border-violet-300 object-cover"
                                  />
                                  <div className="flex flex-col gap-1.5">
                                    <span className="w-fit rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                                      Generada con IA
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      <Button type="button" size="sm" onClick={() => handleUseInSection(s, pending)}>
                                        <Check className="h-3.5 w-3.5" />
                                        {s.sectionId === "gallery" ? "Usar como portada" : "Usar en esta sección"}
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => handleAddToLibrary(s, pending)}
                                      >
                                        <FolderPlus className="h-3.5 w-3.5" />
                                        Agregar a biblioteca
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDiscard(s.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Descartar
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button type="button" variant="ghost" size="sm" onClick={runAudit} loading={auditLoading} className="w-fit">
              {auditLoading ? "Analizando…" : "Volver a analizar"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
