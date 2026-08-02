"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pixelEvents } from "@/lib/pixel/events";

/** Dispara PageView en cada cambio de ruta, incluida la carga inicial. */
export function PixelPageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    pixelEvents.pageView();
  }, [pathname]);

  return null;
}
