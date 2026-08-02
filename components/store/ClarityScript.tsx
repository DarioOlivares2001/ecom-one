"use client";

import Script from "next/script";
import { hasMarketingConsent } from "@/lib/pixel/consent";

type Props = {
  projectId: string;
  enabled: boolean;
};

/**
 * Carga el snippet de Microsoft Clarity (mapas de calor + grabaciones de
 * sesión) solo si está habilitado, hay un Project ID configurado y hay
 * consentimiento de marketing — mismo punto de control que MetaPixelScript
 * (lib/pixel/consent.ts). Sin eventos ni API de servidor: es solo el script.
 */
export function ClarityScript({ projectId, enabled }: Props) {
  const trimmedId = projectId.trim();
  if (!enabled || !trimmedId || !hasMarketingConsent()) return null;

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`
        (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${trimmedId}");
      `}
    </Script>
  );
}
