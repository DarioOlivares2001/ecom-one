import Link from "next/link";
import { formatPrice } from "@/lib/utils/format";
import type { ProductUpsellState } from "../types";
import { UpsellThumb } from "./UpsellThumb";

/**
 * "También te puede interesar". Nunca se renderiza si `upsell.visible` está
 * vacío — la decisión de qué mostrar (o si mostrar algo) ya la tomó
 * `pickProductUpsellSuggestions` antes de llegar acá (ver lib/product/upsell.ts).
 */
export function RelatedProductsSection({ upsell }: { upsell: ProductUpsellState }) {
  if (upsell.visible.length === 0) return null;

  return (
    <section className="mt-14 px-4 sm:px-6 lg:px-8">
      <h2 className="font-display text-xl font-bold text-[var(--color-text)] sm:text-2xl">
        También te puede interesar
      </h2>

      <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {upsell.visible.map((s) => (
          <Link
            key={s.id}
            href={`/productos/${s.slug}`}
            className="block w-[152px] min-w-[152px] shrink-0 snap-start rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-sm transition-shadow hover:shadow-md sm:w-[200px] sm:min-w-[200px] lg:w-[220px] lg:min-w-[220px]"
          >
            <div className="flex h-full flex-col gap-2">
              <UpsellThumb src={s.image} alt={s.name} />
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="line-clamp-2 min-h-[2.25rem] text-xs font-semibold leading-snug text-[var(--color-text)]">
                  {s.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {s.price > s.offerPrice && (
                    <span className="text-[10px] text-[var(--color-text-muted)] line-through">
                      {formatPrice(s.price)}
                    </span>
                  )}
                  <span className="text-sm font-extrabold text-[var(--color-text)]">
                    {formatPrice(s.offerPrice)}
                  </span>
                </div>
                {s.savings > 0 && (
                  <p className="mt-0.5 inline-flex w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                    Ahorras {formatPrice(s.savings)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  upsell.onAdd(s);
                }}
                className="mt-1 inline-flex h-8 w-full items-center justify-center rounded-full border border-transparent [background:var(--brand-gradient)] px-3 text-xs font-bold text-white transition-transform duration-150 active:scale-[0.97]"
              >
                {upsell.addedSuggestionId === s.id ? "Agregado" : "Agregar"}
              </button>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
