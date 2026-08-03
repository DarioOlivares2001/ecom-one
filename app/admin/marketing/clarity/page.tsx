import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { getStoreSettingsRow, upsertStoreSettings } from "@/lib/db/repositories/storeSettings";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import { ClarityMarketingForm } from "./ClarityMarketingForm";

export const metadata: Metadata = { title: "Microsoft Clarity — Marketing" };

export type SaveClarityResult = { error?: string; success?: boolean };

/**
 * Guardado independiente de Clarity: toca SOLO clarity_project_id y
 * clarity_enabled en store_settings. No afecta ni depende del guardado de
 * Meta ni de Configuración general.
 */
async function saveClaritySettingsAction(formData: FormData): Promise<SaveClarityResult> {
  "use server";

  if (!getAdminSessionFromCookies()) {
    return { error: "No autorizado." };
  }

  const projectId = String(formData.get("clarity_project_id") ?? "").trim();
  const enabled = formData.get("clarity_enabled") === "true";

  const existing = await getStoreSettingsRow();
  if (!existing) {
    return {
      error: "Primero guarda la configuración general en /admin/configuracion (crea la fila base de la tienda).",
    };
  }

  try {
    await upsertStoreSettings({ clarity_project_id: projectId, clarity_enabled: enabled });
  } catch (error) {
    console.error("[admin/marketing/clarity] Error guardando store_settings:", error);
    return {
      error: `No se pudo guardar: ${error instanceof Error ? error.message : "error desconocido"}`,
    };
  }

  revalidatePath("/admin/marketing");
  revalidatePath("/admin/marketing/clarity");
  return { success: true };
}

export default async function ClarityMarketingPage() {
  const settings = await getStoreSettings();
  return <ClarityMarketingForm settings={settings} action={saveClaritySettingsAction} />;
}
