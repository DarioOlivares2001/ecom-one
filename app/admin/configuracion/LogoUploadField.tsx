"use client";

import { useCallback, useState } from "react";
import type { LogoKind } from "@/lib/images/compressLogoImage";

type Props = {
  formId: string;
  fieldName: string;
  label: string;
  kind: LogoKind;
  initialUrl: string;
  helperText?: string;
};

export function LogoUploadField({ formId, fieldName, label, kind, initialUrl, helperText }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", kind);
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        originalBytes?: number;
        optimizedBytes?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "Error al subir");
      if (!data.url) throw new Error("Sin URL");
      const metaText =
        typeof data.originalBytes === "number" && typeof data.optimizedBytes === "number"
          ? `${(data.originalBytes / 1024).toFixed(1)} KB → ${(data.optimizedBytes / 1024).toFixed(1)} KB`
          : null;
      return { url: data.url, metaText };
    },
    [kind]
  );

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMeta(null);
    try {
      const result = await upload(file);
      setUrl(result.url);
      setMeta(result.metaText);
    } catch (err) {
      setMeta(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      {helperText ? <p className="text-xs text-zinc-500">{helperText}</p> : null}

      <input type="hidden" name={fieldName} form={formId} value={url} />

      <div className="flex items-center gap-3">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-[repeating-conic-gradient(#e5e7eb_0%_25%,white_0%_50%)] bg-[length:12px_12px] ${
            kind === "square" ? "h-14 w-14" : "h-12 w-24"
          }`}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Vista previa ${label}`} className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-zinc-400">Sin logo</span>
          )}
        </div>
        <label className="flex cursor-pointer flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Subir imagen</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="text-xs file:mr-2 file:rounded file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white"
            disabled={busy}
            onChange={(ev) => void onFile(ev)}
          />
        </label>
      </div>
      {busy ? <p className="text-xs text-zinc-500">Optimizando y subiendo…</p> : null}
      {meta ? <p className="text-xs text-zinc-600">{meta}</p> : null}
    </div>
  );
}
