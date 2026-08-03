import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Hero } from "@/components/store/Hero";
import { Button } from "@/components/ui/Button";
import { BentoGrid } from "@/components/store/BentoGrid";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { resolveLandingBentoSections } from "@/lib/store/landing-home-catalog";
import { formatPrice } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Tienda online",
  description: "Explora nuestro catálogo y compra con confianza: despacho rápido y checkout simple.",
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const settings = await getStoreSettings();
  const { starterItems, offerProducts } = await resolveLandingBentoSections();

  return (
    <main>
      <Hero
        desktopBannerUrl={settings.hero_banner_desktop_url}
        mobileBannerUrl={settings.hero_banner_mobile_url}
        heroOverlayMode={settings.hero_overlay_mode}
        heroOverlayOpacity={settings.hero_overlay_opacity}
      />

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-8 font-display text-3xl font-bold text-[var(--color-text)] sm:text-4xl">
          ¿Buscas productos en los que puedas confiar?
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
          {[
            "Productos que no cumplen lo que prometen",
            "Envíos lentos o poco confiables",
            "Atención al cliente que no responde",
            "Precios poco transparentes",
          ].map((problem) => (
            <article
              key={problem}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4"
            >
              <p className="text-sm font-semibold text-[var(--color-text)]">{problem}</p>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-base font-medium text-[var(--color-text)] sm:text-lg">
          Con nosotros, comprar online no tiene por qué ser así.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/productos">
            <Button size="lg" variant="primary">
              Ver productos recomendados
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl border-t border-[var(--color-border)] px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <h2 className="mb-6 text-center font-display text-3xl font-bold text-[var(--color-text)] sm:mb-8 sm:text-4xl">
          Productos seleccionados con criterio
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-center text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg">
          Elegimos cada producto pensando en calidad, utilidad real y una buena experiencia de compra de principio a fin.
        </p>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            "Calidad verificada",
            "Despacho rápido y seguro",
            "Soporte cuando lo necesitas",
          ].map((item) => (
            <article
              key={item}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 text-center"
            >
              <p className="text-sm font-semibold text-[var(--color-text)]">{item}</p>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-base font-medium text-[var(--color-text)] sm:text-lg">
          Compra con confianza, sin sorpresas.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/productos">
            <Button size="lg" variant="primary">
              Ver productos recomendados
            </Button>
          </Link>
        </div>
      </section>

      <BentoGrid title="Empieza con estos productos" items={starterItems} />

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
    </main>
  );
}
