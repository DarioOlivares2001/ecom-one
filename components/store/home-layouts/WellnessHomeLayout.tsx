import Image from "next/image";
import Link from "next/link";
import { HeartHandshake, Leaf, PackageSearch, Repeat } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BentoGrid } from "@/components/store/BentoGrid";
import { formatPrice } from "@/lib/utils/format";
import type { HomeLayoutProps } from "./types";

/**
 * Copy genérico sobre la EXPERIENCIA DE COMPRA (rutina, confianza,
 * acompañamiento) — nunca una afirmación sobre lo que un producto hace o
 * contiene. Ningún claim médico, de ingrediente ni de certificación.
 */
const BENEFITS = [
  {
    icon: Repeat,
    title: "Pensado para tu rutina",
    description: "Encuentra lo que necesitas para sostener tus hábitos día a día.",
  },
  {
    icon: Leaf,
    title: "Información clara",
    description: "Cada ficha muestra lo que realmente cargamos, sin promesas vacías.",
  },
  {
    icon: HeartHandshake,
    title: "Acompañamiento real",
    description: "Te acompañamos antes y después de tu compra, con pago protegido.",
  },
];

/**
 * Tema "Bienestar y suplementos" — Home editorial: foco en rutina, confianza
 * y categorías de bienestar. Usa exactamente los mismos datos reales que el
 * tema base (mismo catálogo, mismas categorías, mismas ofertas) — solo
 * cambia composición, orden y copy de encabezados. Nunca inventa ingredientes,
 * certificaciones ni claims médicos.
 */
export function WellnessHomeLayout({ starterItems, offerProducts, categories, hasCatalog }: HomeLayoutProps) {
  return (
    <>
      {/* ── Beneficios de la experiencia (rutina / confianza / bienestar) ── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-9 text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <p className="font-display text-base font-bold text-[var(--color-text)]">{title}</p>
              <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{description}</p>
            </article>
          ))}
        </div>
      </section>

      {hasCatalog ? (
        <>
          {/* ── Categorías de bienestar (dinámico, mismos datos reales) ── */}
          {categories.length > 0 && (
            <section className="mx-auto w-full max-w-7xl border-t border-[var(--color-border)] px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
              <h2 className="mb-2 font-display text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                Encuentra tu categoría de bienestar
              </h2>
              <p className="mb-7 max-w-2xl text-sm text-[var(--color-text-muted)]">
                Explora por tipo de producto y llega directo a lo que buscas.
              </p>
              <div className="flex flex-wrap gap-3">
                {categories.map((category) => (
                  <Link
                    key={category}
                    href={`/productos?categoria=${encodeURIComponent(category)}`}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Novedades / destacados (datos reales) ── */}
          <div id="novedades" className="scroll-mt-24">
            <BentoGrid title="Recién llegados para tu rutina" items={starterItems} />
          </div>

          {offerProducts.length > 0 ? (
            <section className="mx-auto w-full max-w-7xl border-t border-[var(--color-border)] px-4 py-16 sm:px-6 lg:px-8">
              <h2 className="font-display text-3xl font-bold text-[var(--color-text)] sm:text-4xl">
                Precio especial, por tiempo limitado
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-[var(--color-text-muted)] sm:text-base">
                Productos seleccionados con descuento real, mientras dure el stock.
              </p>

              <div className="mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0">
                {offerProducts.map((product) => {
                  const compareAt = product.compare_at_price ?? product.price;
                  const discount = Math.max(0, Math.round((1 - product.price / compareAt) * 100));
                  return (
                    <article
                      key={product.id}
                      className="min-w-[270px] snap-start overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm md:min-w-0"
                    >
                      <div className="relative aspect-square bg-zinc-100">
                        <Image
                          src={product.images[0]!}
                          alt={product.name}
                          fill
                          sizes="(max-width: 768px) 78vw, 30vw"
                          className="object-cover"
                        />
                      </div>
                      <div className="p-5">
                        <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text)]">{product.name}</p>
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="text-base font-bold text-[var(--color-text)]">{formatPrice(product.price)}</span>
                          <span className="text-sm text-[var(--color-text-muted)] line-through">
                            {formatPrice(compareAt)}
                          </span>
                          <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            -{discount}%
                          </span>
                        </div>
                        <Link href={`/productos/${product.slug}`} className="mt-4 block">
                          <Button size="md" fullWidth variant="secondary">
                            {product.has_variants ? "Ver opciones" : "Ver producto"}
                          </Button>
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="mx-auto w-full max-w-7xl border-t border-[var(--color-border)] px-4 py-16 sm:px-6 lg:px-8">
            <p className="mx-auto max-w-2xl text-center text-base font-medium text-[var(--color-text)] sm:text-lg">
              Empieza tu rutina de bienestar hoy
            </p>
            <div className="mt-6 flex justify-center">
              <Link href="/productos">
                <Button size="lg" variant="primary">
                  Ver catálogo
                </Button>
              </Link>
            </div>
          </section>
        </>
      ) : (
        /* ── Empty state: aún no hay productos publicados ── */
        <section className="mx-auto w-full max-w-7xl border-t border-[var(--color-border)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
            <PackageSearch className="h-14 w-14 text-[var(--color-text-muted)]" strokeWidth={1} />
            <div>
              <p className="font-display text-xl font-bold text-[var(--color-text)]">
                Estamos preparando tu selección de bienestar
              </p>
              <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
                Todavía no hay productos publicados. Vuelve pronto para descubrir la selección.
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
