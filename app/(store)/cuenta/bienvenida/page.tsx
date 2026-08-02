import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { BienvenidaClient } from "./BienvenidaClient";

function firstString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function BienvenidaCuentaPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const settings = await getStoreSettings();
  const qNombre = firstString(searchParams.nombre)?.trim();
  const qEmail = firstString(searchParams.email)?.trim();
  const recoveryHint = firstString(searchParams.recovery) === "1";

  return (
    <BienvenidaClient
      storeName={settings.store_name}
      queryNombre={qNombre || undefined}
      queryEmail={qEmail || undefined}
      recoveryHint={recoveryHint}
    />
  );
}
