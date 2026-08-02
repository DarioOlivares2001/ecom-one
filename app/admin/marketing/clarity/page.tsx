import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
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

  const projectId = String(formData.get("clarity_project_id") ?? "").trim();
  const enabled = formData.get("clarity_enabled") === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data: existing } = await supabase
    .from("store_settings")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing?.id) {
    return {
      error: "Primero guarda la configuración general en /admin/configuracion (crea la fila base de la tienda).",
    };
  }

  const { error } = await supabase
    .from("store_settings")
    .update({ clarity_project_id: projectId, clarity_enabled: enabled })
    .eq("id", existing.id);

  if (error) {
    console.error("[admin/marketing/clarity] Error guardando store_settings:", error.message);
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/admin/marketing");
  revalidatePath("/admin/marketing/clarity");
  return { success: true };
}

export default async function ClarityMarketingPage() {
  const settings = await getStoreSettings();
  return <ClarityMarketingForm settings={settings} action={saveClaritySettingsAction} />;
}
