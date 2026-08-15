"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import Image from "next/image";
import { GripVertical, Loader2, Upload, X } from "lucide-react";
import { clsx } from "clsx";

import { toast } from "@/components/ui/Toast";
import { compressImageIfNeeded } from "@/lib/images/compressImage";
import { uploadProductImage } from "@/lib/admin/uploadProductImage";
import { LIBRARY_IMAGE_DRAG_MIME } from "./product-sections/ImagePicker";

interface SectionUsageRef {
  id: string;
  label: string;
}

interface ProductMediaLibraryProps {
  /** URLs ya subidas a R2, en el orden de la galería (`products.images`). */
  images: string[];
  /**
   * Mismo tipo que el setter de `useState<string[]>`: acepta un array nuevo o
   * un updater funcional. Se requiere la forma funcional porque varias subidas
   * pueden resolver en paralelo y cada una debe partir del estado más reciente,
   * no de la instantánea de `images` capturada cuando empezó su propia subida.
   */
  onChange: Dispatch<SetStateAction<string[]>>;
  /** Devuelve los bloques que usan una URL dada, para advertir antes de borrar. */
  findUsage?: (url: string) => SectionUsageRef[];
  /** Se avisa al padre mientras haya subidas en curso (para bloquear "Guardar"). */
  onUploadingChange?: (uploading: boolean) => void;
}

type PendingUpload = { id: string; name: string };

export function ProductMediaLibrary({
  images,
  onChange,
  findUsage,
  onUploadingChange,
}: ProductMediaLibraryProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dropOver, setDropOver] = useState(false);
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);

  function setPendingAndNotify(updater: (prev: PendingUpload[]) => PendingUpload[]) {
    setPending((prev) => {
      const next = updater(prev);
      onUploadingChange?.(next.length > 0);
      return next;
    });
  }

  async function addFiles(files: FileList | File[]) {
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!valid.length) return;

    const jobs = valid.map((file) => ({ id: `${Date.now()}-${Math.random()}`, file }));
    setPendingAndNotify((prev) => [...prev, ...jobs.map((j) => ({ id: j.id, name: j.file.name }))]);

    await Promise.all(
      jobs.map(async ({ id, file }) => {
        try {
          const compressed = await compressImageIfNeeded(file);
          const url = await uploadProductImage(compressed.file);
          onChange((prev) => [...prev, url]);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Error al subir ${file.name}.`);
        } finally {
          setPendingAndNotify((prev) => prev.filter((p) => p.id !== id));
        }
      })
    );
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDropOver(false);
    await addFiles(e.dataTransfer.files);
  }

  function handleDelete(url: string) {
    const usage = findUsage?.(url) ?? [];
    const message =
      usage.length > 0
        ? `Esta imagen se usa en: ${usage.map((u) => u.label).join(", ")}.\n\n¿Eliminarla de la biblioteca de todas formas? Esos bloques quedarán sin imagen asignada.`
        : "¿Eliminar esta imagen de la biblioteca?";
    if (!confirm(message)) return;
    onChange((prev) => prev.filter((u) => u !== url));
  }

  function handleThumbDragStart(e: React.DragEvent, idx: number, url: string) {
    e.dataTransfer.effectAllowed = "copyMove";
    e.dataTransfer.setData(LIBRARY_IMAGE_DRAG_MIME, url);
    e.dataTransfer.setData("text/plain", url);
    setDragSrcIdx(idx);
  }

  function handleThumbDragOver(e: React.DragEvent, toIdx: number) {
    e.preventDefault();
    if (dragSrcIdx === null || dragSrcIdx === toIdx) return;
    onChange((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragSrcIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragSrcIdx(toIdx);
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles(e.target.files ?? []);
          e.target.value = "";
        }}
      />

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
          dropOver ? "border-[var(--color-primary)] bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"
        )}
      >
        <Upload className={clsx("h-7 w-7 transition-colors", dropOver ? "text-[var(--color-primary)]" : "text-zinc-400")} />
        <p className="text-sm font-medium text-zinc-600">
          Arrastra imágenes aquí o{" "}
          <span className="text-[var(--color-primary)]">haz clic para seleccionar</span>
        </p>
        <p className="text-xs text-zinc-400">
          PNG, JPG, WebP · múltiples archivos · quedan disponibles para la galería y para los
          bloques de la ficha
        </p>
      </div>

      {(images.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {images.map((url, i) => (
            <div
              key={`${i}-${url}`}
              draggable
              onDragStart={(e) => handleThumbDragStart(e, i, url)}
              onDragOver={(e) => handleThumbDragOver(e, i)}
              onDragEnd={() => setDragSrcIdx(null)}
              className={clsx(
                "group relative aspect-square cursor-grab overflow-hidden rounded-lg border-2 transition-all active:cursor-grabbing",
                dragSrcIdx === i ? "border-[var(--color-primary)] opacity-40" : "border-zinc-200 hover:border-zinc-400"
              )}
            >
              <Image src={url} alt={`Imagen ${i + 1}`} fill className="object-cover" sizes="80px" />

              <div className="absolute left-1 top-1 hidden group-hover:flex">
                <GripVertical className="h-3.5 w-3.5 text-white drop-shadow" />
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(url);
                }}
                className="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-zinc-900/80 text-white group-hover:flex"
                aria-label="Eliminar imagen"
              >
                <X className="h-3 w-3" />
              </button>

              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-zinc-900/70 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wider text-white">
                  Principal
                </span>
              )}
            </div>
          ))}

          {pending.map((job) => (
            <div
              key={job.id}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 px-1 text-center"
            >
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              <span className="line-clamp-2 text-[9px] text-zinc-400">{job.name}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-zinc-500">
        Reutiliza estas imágenes en &quot;Bloques de la ficha&quot; más abajo: elige de biblioteca o
        arrastra una miniatura hacia el bloque.
      </p>
    </div>
  );
}
