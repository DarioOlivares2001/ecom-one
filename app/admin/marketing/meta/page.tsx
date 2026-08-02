import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { MetaMarketingForm } from "./MetaMarketingForm";

export const metadata: Metadata = { title: "Meta — Marketing" };

export type SaveMetaResult = { error?: string; success?: boolean };

/**
 * Guardado independiente de Meta: toca SOLO las 4 columnas meta_* de
 * store_settings. Un error acá nunca afecta el guardado de /admin/configuracion,
 * y viceversa — son dos formularios y dos acciones separadas.
 */
async function saveMetaSettingsAction(formData: FormData): Promise<SaveMetaResult> {
  "use server";

  function read(field: string) {
    return String(formData.get(field) ?? "").trim();
  }
  function readBoolean(field: string) {
    return formData.get(field) === "true";
  }

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

  const payload: Record<string, unknown> = {
    meta_pixel_id: read("meta_pixel_id"),
    meta_pixel_enabled: readBoolean("meta_pixel_enabled"),
    meta_test_event_code: read("meta_test_event_code"),
  };

  // Secreto: el input siempre llega vacío salvo que el admin haya escrito un
  // valor nuevo. Si viene vacío, se omite del payload para NO pisar el token
  // ya guardado con "".
  const submittedToken = read("meta_capi_access_token");
  if (submittedToken) {
    payload.meta_capi_access_token = submittedToken;
  }

  const { error } = await supabase.from("store_settings").update(payload).eq("id", existing.id);
  if (error) {
    console.error("[admin/marketing/meta] Error guardando store_settings:", error.message);
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/admin/marketing");
  revalidatePath("/admin/marketing/meta");
  return { success: true };
}

export default async function MetaMarketingPage() {
  const settings = await getStoreSettings();
  return <MetaMarketingForm settings={settings} action={saveMetaSettingsAction} />;
}
