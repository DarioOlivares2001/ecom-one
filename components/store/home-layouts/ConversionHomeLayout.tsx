import Image from "next/image";
import Link from "next/link";
import { PackageSearch, ShieldCheck, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BentoGrid } from "@/components/store/BentoGrid";
import { formatPrice } from "@/lib/utils/format";
import type { HomeLayoutProps } from "./types";

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: "Compra segura",
    description: "Pago protegido y datos resguardados en cada pedido.",
  },
  {
    icon: Users,
    title: "Atención cercana",
    description: "Te acompañamos antes y después de tu compra.",
  },
  {
    icon: Truck,
    title: "Despacho a domicilio",
    description: "Recibe tu pedido directamente donde estés.",
  },
];

/**
 * Tema "Conversión general" — layout de Home base (el mismo que ya existía
 * antes de separar temas estructurales). Beneficios genéricos, categorías,
 * novedades y ofertas por delante.
 */
export function ConversionHomeLayout({ starterItems, offerProducts, categories, hasCatalog }: HomeLayoutProps) {
  return (
    <>
      {/* ── Benefits ── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="flex flex-col items-center gap-2.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-7 text-center"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="font-display text-base font-bold text-[var(--color-text)]">{title}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
            </article>
          ))}
        </div>
      </section>

      {hasCatalog ? (
        <>
          {/* ── Categories (dynamic, from active products) ── */}
          {categories.length > 0 && (
            <section className="mx-auto w-full max-w-7xl border-t border-[var(--color-border)] px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
              <h2 className="mb-6 font-display text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                Explora por categoría
              </h2>
              <div className="flex flex-wrap gap-2.5">
                {categories.map((category) => (
                  <Link
                    key={category}
                    href={`/productos?categoria=${encodeURIComponent(category)}`}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Novedades / destacados (datos reales) ── */}
          <div id="novedades" className="scroll-mt-24">
            <BentoGrid title="Novedades" items={starterItems} />
          </div>

          {offerProducts.length > 0 ? (
            <section className="mx-auto w-full max-w-7xl border-t border-[var(--color-border)] px-4 py-14 sm:px-6 lg:px-8">
              <h2 className="font-display text-3xl font-bold text-[var(--color-text)] sm:text-4xl">
                Productos en oferta
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-[var(--color-text-muted)] sm:text-base">
                Aprovecha descuentos por tiempo limitado en productos seleccionados.
              </p>

              <div className="mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:pb-0">
                {offerProducts.map((product) => {
                  const compareAt = product.compare_at_price ?? product.price;
                  const discount = Math.max(0, Math.round((1 - product.price / compareAt) * 100));
                  return (
                    <article
                      key={product.id}
                      className="min-w-[270px] snap-start overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm md:min-w-0"
                    >
                      <div className="relative aspect-[4/3] bg-zinc-100">
                        <Image
                          src={product.images[0]!}
                          alt={product.name}
                          fill
                          sizes="(max-width: 768px) 78vw, 30vw"
                          className="object-cover"
                        />
                      </div>
                      <div className="p-4">
                        <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text)]">{product.name}</p>
                        <div className="mt-2 flex items-center gap-2">
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

          <section className="mx-auto w-full max-w-7xl border-t border-[var(--color-border)] px-4 py-14 sm:px-6 lg:px-8">
            <p className="mx-auto max-w-2xl text-center text-base font-medium text-[var(--color-text)] sm:text-lg">
              Encuentra lo que buscas y compra hoy mismo
            </p>
            <div className="mt-6 flex justify-center">
              <Link href="/productos">
                <Button size="lg" variant="primary">
                  Comprar ahora
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
                Estamos preparando el catálogo
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
