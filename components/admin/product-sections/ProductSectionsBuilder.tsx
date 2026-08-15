"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";

import {
  createNewSection,
  reindexSections,
} from "@/lib/product/sections/defaults";
import { purgeImageReference } from "@/lib/product/sections/imageUsage";
import { parseProductSectionsLoose } from "@/lib/product/sections/parse";
import type {
  BeforeAfterData,
  BenefitsData,
  FaqData,
  MeasurementsData,
  MediaStripData,
  ProductSection,
  ProductSectionList,
  ProductSectionType,
  TestimonialsData,
  UsageData,
  VersatilityData,
  VisualSequenceData,
} from "@/lib/product/sections/types";

import { AddSectionMenu } from "./AddSectionMenu";
import { BeforeAfterEditor } from "./editors/BeforeAfterEditor";
import { BenefitsEditor } from "./editors/BenefitsEditor";
import { FaqEditor } from "./editors/FaqEditor";
import { MediaStripEditor } from "./editors/MediaStripEditor";
import { SingleImageEditor } from "./editors/SingleImageEditor";
import { TestimonialsEditor } from "./editors/TestimonialsEditor";
import { VisualSequenceEditor } from "./editors/VisualSequenceEditor";
import { SectionCard } from "./SectionCard";

export interface ProductSectionsBuilderHandle {
  /** Vacía toda referencia a `url` en los bloques (borrado en cascada desde la biblioteca de medios). */
  purgeImageReference: (url: string) => void;
}

interface ProductSectionsBuilderProps {
  /** Valor inicial (puede ser cualquier JSON del JSONB en BD). */
  initialSections: unknown;
  /** Nombre del hidden input que se enviará en el FormData del form padre. */
  hiddenInputName: string;
  /** Biblioteca de medios del producto (`product_media`), para los selectores de imagen de cada bloque. */
  images: string[];
  /**
   * Espejo de solo lectura del estado interno hacia el padre — no cambia el
   * comportamiento uncontrolled del componente, solo le permite al padre (ej.
   * para el aviso "esta imagen se usa en...") saber qué bloques existen sin
   * romper el aislamiento de `initialSections`.
   */
  onSectionsChange?: (sections: ProductSectionList) => void;
}

const MAX_SECTIONS = 20;

export const ProductSectionsBuilder = forwardRef<
  ProductSectionsBuilderHandle,
  ProductSectionsBuilderProps
>(function ProductSectionsBuilder(
  { initialSections, hiddenInputName, images, onSectionsChange },
  ref,
) {
  // El componente es UNCONTROLLED: parseamos `initialSections` una sola vez al
  // montar para que re-renders del padre (cambios en otros campos del form) no
  // sobreescriban el estado local del usuario mientras edita los bloques.
  const [sections, setSections] = useState<ProductSectionList>(() =>
    parseProductSectionsLoose(initialSections),
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial = parseProductSectionsLoose(initialSections);
    // Colapsamos todo si hay varios; expandimos si hay solo uno o ninguno.
    if (initial.length <= 1) {
      return Object.fromEntries(initial.map((s) => [s.id, true]));
    }
    return {};
  });

  const serialized = useMemo(() => JSON.stringify(sections), [sections]);

  useEffect(() => {
    onSectionsChange?.(sections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  useImperativeHandle(
    ref,
    () => ({
      purgeImageReference: (url: string) => {
        setSections((prev) => reindexSections(purgeImageReference(prev, url)));
      },
    }),
    [],
  );

  function commit(next: ProductSectionList) {
    setSections(reindexSections(next));
  }

  function handleAdd(type: ProductSectionType) {
    if (sections.length >= MAX_SECTIONS) return;
    const newSection = createNewSection(type, sections.length);
    commit([...sections, newSection]);
    setExpanded((prev) => ({ ...prev, [newSection.id]: true }));
  }

  function handleRemove(id: string) {
    commit(sections.filter((s) => s.id !== id));
    setExpanded((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleToggleEnabled(id: string) {
    commit(
      sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
  }

  function handleMove(id: string, direction: -1 | 1) {
    const index = sections.findIndex((s) => s.id === id);
    if (index < 0) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const next = [...sections];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    commit(next);
  }

  function handleToggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleUpdateData(id: string, nextData: ProductSection["data"]) {
    commit(
      sections.map((s) => {
        if (s.id !== id) return s;
        // Truco de tipos: cada update viene del editor de su propio tipo.
        return { ...s, data: nextData } as ProductSection;
      }),
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">
            Bloques de la ficha
          </h3>
          <p className="mt-1 text-xs text-zinc-500 sm:max-w-md">
            Construye la ficha del producto combinando bloques modulares. Si no
            agregas ninguno, se sigue mostrando la descripción HTML clásica.
          </p>
        </div>
        <AddSectionMenu
          onAdd={handleAdd}
          disabled={sections.length >= MAX_SECTIONS}
        />
      </header>

      {sections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-8 text-center">
          <p className="text-sm font-medium text-zinc-700">
            Aún no hay bloques modulares.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Mientras no agregues bloques, la ficha usa la descripción HTML
            existente.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sections.map((section, i) => {
            const isOpen = expanded[section.id] ?? false;
            return (
              <SectionCard
                key={section.id}
                section={section}
                position={i}
                total={sections.length}
                expanded={isOpen}
                onToggleExpand={() => handleToggleExpand(section.id)}
                onToggleEnabled={() => handleToggleEnabled(section.id)}
                onMoveUp={() => handleMove(section.id, -1)}
                onMoveDown={() => handleMove(section.id, 1)}
                onRemove={() => handleRemove(section.id)}
              >
                {section.type === "benefits" && (
                  <BenefitsEditor
                    data={section.data}
                    images={images}
                    onChange={(next: BenefitsData) =>
                      handleUpdateData(section.id, next)
                    }
                  />
                )}
                {section.type === "media_strip" && (
                  <MediaStripEditor
                    data={section.data}
                    images={images}
                    onChange={(next: MediaStripData) =>
                      handleUpdateData(section.id, next)
                    }
                  />
                )}
                {section.type === "faq" && (
                  <FaqEditor
                    data={section.data}
                    onChange={(next: FaqData) =>
                      handleUpdateData(section.id, next)
                    }
                  />
                )}
                {section.type === "testimonials" && (
                  <TestimonialsEditor
                    data={section.data}
                    onChange={(next: TestimonialsData) =>
                      handleUpdateData(section.id, next)
                    }
                  />
                )}
                {section.type === "before_after" && (
                  <BeforeAfterEditor
                    data={section.data}
                    images={images}
                    onChange={(next: BeforeAfterData) =>
                      handleUpdateData(section.id, next)
                    }
                  />
                )}
                {section.type === "visual_sequence" && (
                  <VisualSequenceEditor
                    data={section.data}
                    images={images}
                    onChange={(next: VisualSequenceData) =>
                      handleUpdateData(section.id, next)
                    }
                  />
                )}
                {section.type === "usage" && (
                  <SingleImageEditor
                    data={section.data}
                    images={images}
                    headingPlaceholder='Ej: "Cómo usarlo"'
                    onChange={(next: UsageData) =>
                      handleUpdateData(section.id, next)
                    }
                  />
                )}
                {section.type === "measurements" && (
                  <SingleImageEditor
                    data={section.data}
                    images={images}
                    headingPlaceholder='Ej: "Medidas"'
                    onChange={(next: MeasurementsData) =>
                      handleUpdateData(section.id, next)
                    }
                  />
                )}
                {section.type === "versatility" && (
                  <SingleImageEditor
                    data={section.data}
                    images={images}
                    headingPlaceholder='Ej: "Versatilidad"'
                    onChange={(next: VersatilityData) =>
                      handleUpdateData(section.id, next)
                    }
                  />
                )}
              </SectionCard>
            );
          })}
        </div>
      )}

      {/* Hidden input que viaja con el FormData del form padre */}
      <input type="hidden" name={hiddenInputName} value={serialized} />
    </section>
  );
});
