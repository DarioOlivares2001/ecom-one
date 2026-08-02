"use client";

import { useCallback, useState } from "react";

type Props = {
  formId: string;
  initialFaviconUrl: string;
  initialAppleIconUrl: string;
  initialPwaIconUrl: string;
};

export function FaviconUploadSection({
  formId,
  initialFaviconUrl,
  initialAppleIconUrl,
  initialPwaIconUrl,
}: Props) {
  const [faviconUrl, setFaviconUrl] = useState(initialFaviconUrl);
  const [appleIconUrl, setAppleIconUrl] = useState(initialAppleIconUrl);
  const [pwaIconUrl, setPwaIconUrl] = useState(initialPwaIconUrl);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<string | null>(null);

  const upload = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload/favicon", { method: "POST", body: fd });
    const data = (await res.json()) as {
      faviconUrl?: string;
      appleIconUrl?: string;
      pwaIconUrl?: string;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Error al subir");
    if (!data.faviconUrl || !data.appleIconUrl || !data.pwaIconUrl) throw new Error("Respuesta incompleta");
    return data as { faviconUrl: string; appleIconUrl: string; pwaIconUrl: string };
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMeta(null);
    try {
      const result = await upload(file);
      setFaviconUrl(result.faviconUrl);
      setAppleIconUrl(result.appleIconUrl);
      setPwaIconUrl(result.pwaIconUrl);
      setMeta("Generados: 32×32, 180×180 y 512×512.");
    } catch (err) {
      setMeta(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 md:col-span-2">
      <span className="text-sm font-medium text-zinc-700">Favicon / íconos</span>
      <p className="text-xs text-zinc-500">
        Sube una imagen cuadrada (idealmente con fondo transparente) y se generan automáticamente los 3
        tamaños que necesitan el navegador (32×32), iOS (180×180) y PWA/Android (512×512).
      </p>

      <input type="hidden" name="favicon_url" form={formId} value={faviconUrl} />
      <input type="hidden" name="apple_icon_url" form={formId} value={appleIconUrl} />
      <input type="hidden" name="pwa_icon_512_url" form={formId} value={pwaIconUrl} />

      <label className="mt-1 flex w-fit cursor-pointer flex-col gap-2">
        <span className="text-xs font-medium text-zinc-600">Subir imagen</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="text-xs file:mr-2 file:rounded file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white"
          disabled={busy}
          onChange={(ev) => void onFile(ev)}
        />
      </label>
      {busy ? <p className="mt-1 text-xs text-zinc-500">Generando tamaños y subiendo…</p> : null}
      {meta ? <p className="mt-1 text-xs text-zinc-600">{meta}</p> : null}

      <div className="mt-2 flex items-end gap-4">
        {[
          { url: faviconUrl, label: "32×32", box: "h-8 w-8" },
          { url: appleIconUrl, label: "180×180", box: "h-14 w-14" },
          { url: pwaIconUrl, label: "512×512", box: "h-20 w-20" },
        ].map((p) => (
          <div key={p.label} className="flex flex-col items-center gap-1.5">
            <div
              className={`flex items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-[repeating-conic-gradient(#e5e7eb_0%_25%,white_0%_50%)] bg-[length:12px_12px] ${p.box}`}
            >
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={`Vista previa ${p.label}`} className="h-full w-full object-contain" />
              ) : null}
            </div>
            <span className="text-[10px] text-zinc-400">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
