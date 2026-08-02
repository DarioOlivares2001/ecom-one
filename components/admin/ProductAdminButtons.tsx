"use client";

import { useState } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { archiveProductAction, restoreProductAction } from "@/app/admin/productos/nuevo/actions";

export function ArchiveProductButton({ id, name }: { id: string; name: string }) {
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    if (
      !confirm(
        `¿Archivar "${name}"?\n\nEl producto se ocultará de la tienda pero no se eliminará. Puedes reactivarlo desde la pestaña "Archivados".`
      )
    )
      return;
    setIsPending(true);
    try {
      const res = await archiveProductAction(id);
      if (res?.error) toast.error(res.error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {isPending ? "Archivando…" : "Archivar"}
    </button>
  );
}

export function RestoreProductButton({ id, name }: { id: string; name: string }) {
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    if (!confirm(`¿Reactivar "${name}"? Volverá a aparecer en la tienda.`)) return;
    setIsPending(true);
    try {
      const res = await restoreProductAction(id);
      if (res?.error) toast.error(res.error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {isPending ? "Reactivando…" : "Reactivar"}
    </button>
  );
}
