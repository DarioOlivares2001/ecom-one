"use client";

import Image, { type ImageProps } from "next/image";
import { twMerge } from "tailwind-merge";
import { isAllowedImageSrc } from "@/lib/images/isAllowedImageSrc";

type SafeImageProps = Omit<ImageProps, "src"> & {
  src: string | null | undefined;
  /** className del div de fallback cuando no hay imagen válida. Por defecto imita el fondo de BentoGrid. */
  fallbackClassName?: string;
};

/**
 * Wrapper de `next/image` que nunca le pasa un `src` no permitido (ver
 * `lib/images/isAllowedImageSrc`). Si la URL no es válida o segura (vacía,
 * corrupta, o de un host no configurado como `*.supabase.co`), renderiza un
 * placeholder visual en vez de dejar que `next/image` rompa la página.
 */
export function SafeImage({ src, className, fallbackClassName, alt, ...rest }: SafeImageProps) {
  if (!isAllowedImageSrc(src)) {
    return (
      <div
        className={twMerge(
          "bg-gradient-to-br from-zinc-100 to-zinc-200",
          className,
          fallbackClassName
        )}
        role="img"
        aria-label={alt || "Imagen no disponible"}
      />
    );
  }

  return <Image src={src} alt={alt} className={className} {...rest} />;
}
