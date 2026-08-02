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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(168,85,247,0.16),transparent_36%),radial-gradient(circle_at_85%_85%,rgba(236,72,153,0.16),transparent_38%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
            <span aria-hidden>💜</span>
            Nuestra historia
          </div>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-5xl">
            También vivimos el problema. Por eso creamos PonkyBonk.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg">
            Sabemos lo frustrante que es gastar en productos que prometen controlar olores, durar
            más o facilitar la limpieza… y que al final no cumplen.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Todo empezó en casa
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-[var(--color-text)]">
            Todo empezó en casa
          </h2>
          <p className="mt-4 max-w-4xl text-base leading-relaxed text-[var(--color-text-muted)]">
            PonkyBonk no nació desde una oficina ni desde una idea fría de negocio. Nació desde
            una necesidad real: queríamos una casa limpia, un gato cómodo y productos que
            realmente funcionaran.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-[var(--color-text)]">Probamos de todo</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            "Arena que no controlaba olores",
            "Productos que duraban poco",
            "Accesorios incómodos o poco prácticos",
            "Soluciones bonitas, pero poco útiles",
          ].map((item) => (
            <article
              key={item}
              className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm"
            >
              <span aria-hidden className="mt-0.5 shrink-0">⚠️</span>
              <p className="text-sm font-medium text-[var(--color-text)] sm:text-base">{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-background)] p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-3xl font-bold text-[var(--color-text)]">
            Cuando encontramos productos que sí funcionaban, quisimos compartirlos
          </h2>
          <p className="mt-4 max-w-4xl text-base leading-relaxed text-[var(--color-text-muted)]">
            Empezamos a elegir productos que nosotros mismos usaríamos: arena que ayuda de verdad
            con el olor, accesorios que reducen el desorden y soluciones que hacen más simple vivir
            con gatos.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-[var(--color-text)]">No vendemos por vender</h2>
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            "Probamos y seleccionamos con criterio",
            "Buscamos utilidad real, no solo apariencia",
            "Priorizamos productos que solucionen problemas cotidianos",
            "Escuchamos a nuestros clientes",
          ].map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <span aria-hidden className="mt-0.5 shrink-0">✅</span>
              <span className="text-sm text-[var(--color-text)] sm:text-base">{bullet}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-3xl font-bold text-[var(--color-text)]">
            Nuestros clientes nos confirmaron que íbamos por buen camino
          </h2>
          <p className="mt-4 max-w-4xl text-base leading-relaxed text-[var(--color-text-muted)]">
            Cuando comenzaron a repetirse los mensajes diciendo que la arena rendía, que el olor
            bajaba y que el despacho era rápido, entendimos que esto no era solo una tienda: era
            una solución real para más personas.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-3xl font-bold text-[var(--color-text)]">
            Si tú también estás cansado de probar productos que no cumplen, prueba algo distinto.
          </h2>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/productos" className="w-full sm:w-auto">
              <Button size="lg" fullWidth className="gap-2">
                <span aria-hidden>🛍️</span>
                Ver productos
              </Button>
            </Link>
            <Link href={`https://wa.me/${settings.support_whatsapp.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" fullWidth className="gap-2">
                <span aria-hidden>💬</span>
                Hablar por WhatsApp
              </Button>
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 text-xs text-[var(--color-text-muted)] sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2">
              <span aria-hidden>🏠</span>
              Hecho pensando en la vida real en casa
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2">
              <span aria-hidden>✨</span>
              Productos seleccionados por utilidad
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2">
              <span aria-hidden>💜</span>
              Marca cercana, sin promesas vacías
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
