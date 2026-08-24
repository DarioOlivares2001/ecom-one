"use client";

import { useState } from "react";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";

export function UpsellThumb({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  const showImage = !!src && !broken;

  return (
    <div className="relative h-24 w-full overflow-hidden rounded-[var(--radius-sm)] bg-zinc-100">
      {showImage ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="180px"
          className="object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-zinc-300">
          <ShoppingBag className="h-6 w-6" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
