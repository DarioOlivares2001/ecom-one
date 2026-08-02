"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  formId: string;
  initialDesktopUrl: string;
  initialMobileUrl: string;
  initialOverlayMode: "manual" | "auto";
  initialOverlayOpacity: number;
};

function formatKb(bytes: number) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function HeroBannerSection({
  formId,
  initialDesktopUrl,
  initialMobileUrl,
  initialOverlayMode,
  initialOverlayOpacity,
}: Props) {
  const [desktopUrl, setDesktopUrl] = useState(initialDesktopUrl);
  const [mobileUrl, setMobileUrl] = useState(initialMobileUrl);
  const [overlayMode, setOverlayMode] = useState<"manual" | "auto">(
    initialOverlayMode === "auto" ? "auto" : "manual"
  );
  const [heroOverlayOpacity, setHeroOverlayOpacity] = useState<number>(() => {
    if (!Number.isFinite(initialOverlayOpacity)) return 60;
    if (initialOverlayOpacity < 0 || initialOverlayOpacity > 90) return 60;
    return Math.round(initialOverlayOpacity / 5) * 5;
  });
  const [desktopBusy, setDesktopBusy] = useState(false);
  const [mobileBusy, setMobileBusy] = useState(false);
  const [desktopMeta, setDesktopMeta] = useState<string | null>(null);
  const [mobileMeta, setMobileMeta] = useState<string | null>(null);

  useEffect(() => {
    console.log("[hero-config] initial desktop url:", initialDesktopUrl || "(empty)");
    console.log("[hero-config] initial mobile url:", initialMobileUrl || "(empty)");
  }, [initialDesktopUrl, initialMobileUrl]);

  const upload = useCallback(
    async (file: File, type: "desktop" | "mobile") => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      const res = await fetch("/api/upload/hero", { method: "POST", body: fd });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        originalBytes?: number;
        optimizedBytes?: number;
        qualityUsed?: number;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Error al subir");
      }
      if (!data.url) throw new Error("Sin URL");
      const meta =
        typeof data.originalBytes === "number" && typeof data.optimizedBytes === "number"
          ? `Original ${formatKb(data.originalBytes)} → optimizado ${formatKb(data.optimizedBytes)}${
              data.qualityUsed != null ? ` (calidad ${data.qualityUsed})` : ""
            }`
          : null;
      return { url: data.url, meta };
    },
    []
  );

  async function onDesktopFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setDesktopBusy(true);
    setDesktopMeta(null);
    try {
      const { url, meta } = await upload(file, "desktop");
      setDesktopUrl(url);
      setDesktopMeta(meta);
      console.log("[hero-config] desktop url set:", url);
    } catch (err) {
      setDesktopMeta(err instanceof Error ? err.message : "Error");
    } finally {
      setDesktopBusy(false);
    }
  }

  async function onMobileFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMobileBusy(true);
    setMobileMeta(null);
    try {
      const { url, meta } = await upload(file, "mobile");
      setMobileUrl(url);
      setMobileMeta(meta);
      console.log("[hero-config] mobile url set:", url);
    } catch (err) {
      setMobileMeta(err instanceof Error ? err.message : "Error");
    } finally {
      setMobileBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <h2 className="text-sm font-semibold text-zinc-800">Banner principal</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Sube imágenes pesadas: se convierten a WebP, se redimensionan y se guardan optimizadas en
        Storage. Luego pulsa &quot;Guardar configuración&quot; para persistir las URLs.
      </p>

      <input type="hidden" name="hero_banner_desktop_url" form={formId} value={desktopUrl} />
      <input type="hidden" name="hero_banner_mobile_url" form={formId} value={mobileUrl} />

      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-800">Desktop</p>
          <p className="mt-1 text-xs text-zinc-500">
            Recomendado: 1600×700 WebP, &lt; 400 KB. Máx. ancho tras optimizar: 1600 px.
          </p>
          <label className="mt-3 flex cursor-pointer flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600">Subir imagen</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="text-xs file:mr-2 file:rounded file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white"
              disabled={desktopBusy}
              onChange={(ev) => void onDesktopFile(ev)}
            />
          </label>
          {desktopBusy ? (
            <p className="mt-2 text-xs text-zinc-500">Optimizando y subiendo…</p>
          ) : null}
          {desktopMeta ? <p className="mt-2 text-xs text-zinc-600">{desktopMeta}</p> : null}
          <div className="mt-3 overflow-hidden rounded-md border border-zinc-200">
            {desktopUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={desktopUrl} alt="Vista previa banner desktop" className="h-40 w-full object-cover" />
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-zinc-400">
                Sin banner desktop
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-800">Mobile</p>
          <p className="mt-1 text-xs text-zinc-500">
            Recomendado: 900×1100 WebP, &lt; 300 KB. Máx. ancho tras optimizar: 900 px.
          </p>
          <label className="mt-3 flex cursor-pointer flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600">Subir imagen</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="text-xs file:mr-2 file:rounded file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white"
              disabled={mobileBusy}
              onChange={(ev) => void onMobileFile(ev)}
            />
          </label>
          {mobileBusy ? (
            <p className="mt-2 text-xs text-zinc-500">Optimizando y subiendo…</p>
          ) : null}
          {mobileMeta ? <p className="mt-2 text-xs text-zinc-600">{mobileMeta}</p> : null}
          <div className="mt-3 overflow-hidden rounded-md border border-zinc-200">
            {mobileUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mobileUrl} alt="Vista previa banner mobile" className="h-40 w-full object-cover" />
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-zinc-400">
                Sin banner mobile (en tienda se usará el desktop)
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700">Modo de overlay</span>
          <select
            name="hero_overlay_mode"
            value={overlayMode}
            onChange={(event) =>
              setOverlayMode(event.target.value === "auto" ? "auto" : "manual")
            }
            className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="manual">Manual</option>
            <option value="auto">Automático inteligente</option>
          </select>
        </label>

        {overlayMode === "manual" ? (
          <label className="mt-4 block">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-zinc-800">Opacidad del banner (%)</span>
              <span className="text-sm font-medium text-zinc-600">{heroOverlayOpacity}%</span>
            </div>
            <input
              type="range"
              name="hero_overlay_opacity"
              min={0}
              max={90}
              step={5}
              value={heroOverlayOpacity}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) {
                  setHeroOverlayOpacity(60);
                  return;
                }
                const clamped = Math.max(0, Math.min(90, next));
                setHeroOverlayOpacity(Math.round(clamped / 5) * 5);
              }}
              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200"
            />
          </label>
        ) : (
          <>
            <input type="hidden" name="hero_overlay_opacity" value={heroOverlayOpacity} />
            <p className="mt-4 text-sm text-zinc-600">
              El sistema ajustará el contraste automáticamente según el banner.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
