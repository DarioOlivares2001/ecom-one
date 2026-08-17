"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";

import { Button } from "@/components/ui/Button";
import {
  AI_PRODUCT_STUDIO_TONES,
  AI_PRODUCT_STUDIO_TONE_LABELS,
  aiProductDraftSchema,
  aiProductStudioInputSchema,
  type AIProductDraft,
  type AIProductStudioTone,
} from "@/lib/ai-product-studio/schema";
import { generateDemoDraft } from "@/lib/ai-product-studio/generateDemoDraft";
import { SECTION_REGISTRY } from "@/lib/product/sections/types";

interface AIProductStudioModalProps {
  /** Biblioteca de medios del producto (`product_media`) — el estudio nunca sube imágenes nuevas, solo elige de acá. */
  mediaLibrary: string[];
  onClose: () => void;
  /** Se llama con el borrador tal como quedó editado en la vista previa, ya filtrado por secciones incluidas. */
  onApply: (draft: AIProductDraft) => void;
}

type Step = "form" | "preview";

const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900";

function sectionLabel(type: string): string {
  return SECTION_REGISTRY.find((s) => s.type === type)?.label ?? type;
}

export function AIProductStudioModal({ mediaLibrary, onClose, onApply }: AIProductStudioModalProps) {
  const [step, setStep] = useState<Step>("form");

  // ── Form state ──────────────────────────────────────────────────────────────
  const [supplierText, setSupplierText] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [commercialGoal, setCommercialGoal] = useState("");
  const [tone, setTone] = useState<AIProductStudioTone>("directo");
  const [formError, setFormError] = useState<string | null>(null);

  // ── Draft/preview state ─────────────────────────────────────────────────────
  const [draft, setDraft] = useState<AIProductDraft | null>(null);
  const [excludedSectionIds, setExcludedSectionIds] = useState<Set<string>>(new Set());
  const [editedCategory, setEditedCategory] = useState("");
  const [editedTags, setEditedTags] = useState("");

  const includedSections = useMemo(
    () => (draft ? draft.product_sections.filter((s) => !excludedSectionIds.has(s.id)) : []),
    [draft, excludedSectionIds]
  );

  function toggleImage(url: string) {
    setSelectedImages((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  }

  function toggleSection(id: string) {
    setExcludedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleGenerate() {
    setFormError(null);
    const parsedInput = aiProductStudioInputSchema.safeParse({
      supplierText,
      selectedImages,
      commercialGoal: commercialGoal.trim() || undefined,
      tone,
    });
    if (!parsedInput.success) {
      setFormError(parsedInput.error.issues[0]?.message ?? "Revisa los datos ingresados.");
      return;
    }

    const generated = generateDemoDraft(parsedInput.data, new Date().toISOString());
    // Autochequeo: el generador debe producir siempre algo válido contra el
    // mismo contrato que se aplicará al formulario — si esto fallara sería un
    // bug del generador, nunca del input del usuario.
    const parsedDraft = aiProductDraftSchema.safeParse(generated);
    if (!parsedDraft.success) {
      console.error("[ai-product-studio] borrador generado inválido:", parsedDraft.error);
      setFormError("El generador produjo un borrador inválido. Revisa la consola para más detalles.");
      return;
    }

    setDraft(parsedDraft.data);
    setExcludedSectionIds(new Set());
    setEditedCategory(parsedDraft.data.category ?? "");
    setEditedTags(parsedDraft.data.tags.join(", "));
    setStep("preview");
  }

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
    onApply(finalDraft);
  }

  function updateDraftField<K extends keyof AIProductDraft>(key: K, value: AIProductDraft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-zinc-100 px-5 py-4">
          <Sparkles className="h-5 w-5 shrink-0 text-zinc-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-zinc-900">Crear ficha con IA</h2>
            <p className="text-xs text-zinc-400">
              {step === "form"
                ? "Fase 1 · modo demo — sin conexión a ningún proveedor de IA."
                : "Vista previa editable — nada se guarda todavía."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === "form" ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="font-semibold">Modo demo:</span> genera un borrador localmente a partir del
                texto que pegues abajo, sin usar ninguna IA externa. Nunca inventa materiales, medidas,
                certificaciones, garantías, stock ni promesas médicas.
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Texto / ficha del proveedor *</label>
                <textarea
                  className={clsx(inputCls, "min-h-[160px] resize-y")}
                  placeholder={
                    "Pega acá el texto tal como lo envía el proveedor.\nUna línea por idea funciona mejor. Usa \"- \" al inicio de una línea para viñetas/beneficios."
                  }
                  value={supplierText}
                  onChange={(e) => setSupplierText(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">
                  Imágenes de la biblioteca * ({selectedImages.length} seleccionada
                  {selectedImages.length === 1 ? "" : "s"})
                </label>
                {mediaLibrary.length === 0 ? (
                  <p className="text-xs text-zinc-400">
                    Sube imágenes en la Biblioteca de medios antes de usar el estudio.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                    {mediaLibrary.map((url) => {
                      const selected = selectedImages.includes(url);
                      return (
                        <button
                          key={url}
                          type="button"
                          onClick={() => toggleImage(url)}
                          className={clsx(
                            "relative aspect-square overflow-hidden rounded-md border-2 transition-colors",
                            selected ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-400"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          {selected && (
                            <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-white">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Objetivo comercial (opcional)</label>
                <input
                  className={inputCls}
                  placeholder="Ej: aumentar conversión en mobile, destacar regalo de temporada..."
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

              {formError && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {formError}
                </div>
              )}
            </div>
          ) : draft ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="font-semibold">Modo demo · {draft.meta.generatedAt}</span> — revisa y edita
                antes de aplicar. Nada se guarda ni se publica en este paso.
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

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">
                  Nombre {draft.meta.pendingFields.includes("name") && <span className="text-amber-600">(por confirmar)</span>}
                </label>
                <input
                  className={inputCls}
                  value={draft.name}
                  placeholder="Por confirmar"
                  onChange={(e) => updateDraftField("name", e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Slug</label>
                <input
                  className={inputCls}
                  value={draft.slug}
                  placeholder="por-confirmar"
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
                    className={inputCls}
                    value={editedCategory}
                    placeholder="Por confirmar"
                    onChange={(e) => setEditedCategory(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Etiquetas (separadas por coma)</label>
                  <input
                    className={inputCls}
                    value={editedTags}
                    placeholder=""
                    onChange={(e) => setEditedTags(e.target.value)}
                  />
                </div>
              </div>

              <p className="text-xs text-zinc-400">
                Meta título y meta descripción se generaron pero el formulario actual todavía no tiene esos
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
                  <div className="flex flex-col divide-y divide-zinc-100 rounded-md border border-zinc-200">
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
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-3.5">
          {step === "form" ? (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleGenerate}>
                <Sparkles className="h-4 w-4" />
                Generar borrador (demo)
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={() => setStep("form")}>
                Volver
              </Button>
              <Button type="button" onClick={handleApply}>
                Aplicar al borrador
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
