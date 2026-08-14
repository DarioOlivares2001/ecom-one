import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return { title: `Nosotros | ${settings.store_name}` };
}

export default async function NosotrosPage() {
  const settings = await getStoreSettings();
  return (
    <main className="bg-[var(--color-background)]">
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
            Nuestra historia
          </div>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-5xl">
            Elegimos lo que vendemos con el mismo criterio con el que compraríamos nosotros
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg">
            Nació como un espacio para descubrir productos útiles, novedosos y con buen valor —
            sin ruido, sin promesas vacías, con una selección pensada de verdad.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Nuestro criterio
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-[var(--color-text)]">
            Cómo elegimos
          </h2>
          <p className="mt-4 max-w-4xl text-base leading-relaxed text-[var(--color-text-muted)]">
            Antes de sumar un producto al catálogo, lo evaluamos por calidad, utilidad real y
            experiencia de compra completa: desde la ficha hasta el despacho.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-[var(--color-text)]">Lo que nos importa</h2>
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            "Selección con criterio, no volumen por volumen",
            "Utilidad real, no solo apariencia",
            "Transparencia en precios y condiciones",
            "Escuchamos a nuestros clientes",
          ].map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <span
                aria-hidden
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]"
              />
              <span className="text-sm text-[var(--color-text)] sm:text-base">{bullet}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-3xl font-bold text-[var(--color-text)]">
            Descubre la selección
          </h2>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/productos" className="w-full sm:w-auto">
              <Button size="lg" fullWidth>
                Ver productos
              </Button>
            </Link>
            <Link
              href={`https://wa.me/${settings.support_whatsapp.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button size="lg" variant="secondary" fullWidth>
                Hablar por WhatsApp
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
