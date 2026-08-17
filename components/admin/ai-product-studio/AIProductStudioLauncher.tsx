"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { AIProductDraft } from "@/lib/ai-product-studio/schema";
import { AIProductStudioModal } from "./AIProductStudioModal";

interface AIProductStudioLauncherProps {
  /** Biblioteca de medios del producto (`product_media`) — misma fuente que el resto del editor. */
  mediaLibrary: string[];
  /** El padre decide cómo volcar el borrador al formulario (nombre, slug, descripción, galería, bloques). */
  onApply: (draft: AIProductDraft) => void;
}

/**
 * Botón "Crear ficha con IA" + el modal del estudio. Vive como componente
 * aparte para que `nuevo/page.tsx` y `EditProductoForm.tsx` lo monten igual,
 * sin duplicar el estado de apertura/cierre del modal.
 */
export function AIProductStudioLauncher({ mediaLibrary, onApply }: AIProductStudioLauncherProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5" />
        Crear ficha con IA
      </Button>

      {open && (
        <AIProductStudioModal
          mediaLibrary={mediaLibrary}
          onClose={() => setOpen(false)}
          onApply={(draft) => {
            onApply(draft);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
