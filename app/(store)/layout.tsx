import { PromoTickerBar } from "@/components/store/PromoTickerBar";
import { Navbar } from "@/components/store/Navbar";
import { Footer } from "@/components/store/Footer";
import { CartDrawer } from "@/components/store/CartDrawer";
import { WhatsAppFab } from "@/components/store/WhatsAppFab";
import { MetaPixelScript } from "@/components/store/MetaPixelScript";
import { PixelPageViewTracker } from "@/components/store/PixelPageViewTracker";
import { ClarityScript } from "@/components/store/ClarityScript";
import { Toaster } from "@/components/ui/Toast";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getStoreSettings();

  return (
    <>
      <MetaPixelScript pixelId={settings.meta_pixel_id} enabled={settings.meta_pixel_enabled} />
      <PixelPageViewTracker />
      <ClarityScript projectId={settings.clarity_project_id} enabled={settings.clarity_enabled} />
      <PromoTickerBar />
      <Navbar settings={settings} />
      {children}
      <Footer settings={settings} />
      <CartDrawer
        enableWhatsappCheckout={settings.enable_whatsapp_checkout}
        whatsappPhone={settings.support_whatsapp}
      />
      <WhatsAppFab phone={settings.support_whatsapp} enabled={settings.enable_whatsapp_fab} />
      <Toaster />
    </>
  );
}
