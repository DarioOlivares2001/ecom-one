"use client";

import Script from "next/script";
import { hasMarketingConsent } from "@/lib/pixel/consent";

type Props = {
  pixelId: string;
  enabled: boolean;
};

/**
 * Carga el snippet base de Meta Pixel solo si está habilitado, hay un
 * pixel_id configurado y hay consentimiento de marketing (lib/pixel/consent.ts).
 * No dispara PageView acá — eso lo hace PixelPageViewTracker, para no duplicar.
 */
export function MetaPixelScript({ pixelId, enabled }: Props) {
  const trimmedId = pixelId.trim();
  if (!enabled || !trimmedId || !hasMarketingConsent()) return null;

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${trimmedId}');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${trimmedId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
