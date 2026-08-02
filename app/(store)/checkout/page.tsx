import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { CheckoutClient } from "./CheckoutClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CheckoutPage() {
  const settings = await getStoreSettings();
  return (
    <CheckoutClient
      shippingCostClp={settings.shipping_cost_clp}
      freeShippingThresholdClp={settings.shipping_free_threshold_clp}
    />
  );
}
