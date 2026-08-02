import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return {
    title: "Política de Devoluciones",
    description: `Política de devoluciones y derecho a retracto de ${settings.store_name} según Ley 19.496.`,
  };
}

export default async function DevolucionesPage() {
  const settings = await getStoreSettings();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-8 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al inicio
      </Link>

      <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
        Política de Devoluciones
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Última actualización: abril 2026
      </p>

      <div className="mt-10 flex flex-col gap-10">

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">1. Derecho a retracto</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Conforme al <strong className="text-[var(--color-text)]">artículo 3° bis de la Ley 19.496</strong> de Protección al Consumidor, tienes derecho a retractarte de tu compra dentro de los <strong className="text-[var(--color-text)]">10 días hábiles</strong> siguientes a la recepción del producto, sin necesidad de expresar una causa.
          </p>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Este derecho aplica a compras realizadas a distancia (online) y opera siempre que el producto no haya sido usado y se encuentre en su estado original.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">2. Condiciones para la devolución</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">Para que una devolución sea aceptada, el producto debe cumplir con las siguientes condiciones:</p>
          <ul className="ml-5 flex list-disc flex-col gap-2 text-[var(--color-text-muted)]">
            <li>Estar en su estado original, sin uso, lavado ni alteraciones.</li>
            <li>Contar con todas sus etiquetas originales.</li>
            <li>Incluir el embalaje original o equivalente que proteja el producto durante el envío.</li>
            <li>Acompañarse del número de orden o comprobante de compra.</li>
          </ul>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            No se aceptan devoluciones de productos personalizados, de higiene íntima ni de aquellos que por su naturaleza no puedan ser devueltos una vez abiertos.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">3. Cómo solicitar una devolución</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">Para iniciar el proceso de devolución, sigue estos pasos:</p>
          <ol className="ml-5 flex list-decimal flex-col gap-2 text-[var(--color-text-muted)]">
            <li>
              Contáctanos dentro del plazo de 10 días hábiles desde la recepción del producto, indicando tu número de orden y el motivo.
            </li>
            <li>
              Envíanos fotos del producto en su estado actual para una revisión preliminar.
            </li>
            <li>
              Te enviaremos instrucciones para el envío de devolución. El costo de este envío es de cargo del comprador, salvo que el motivo sea un producto defectuoso o equivocado.
            </li>
            <li>
              Una vez recibido e inspeccionado el producto (plazo de 3 días hábiles), confirmaremos la devolución.
            </li>
          </ol>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">4. Reembolso</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Una vez aprobada la devolución, realizaremos el reembolso por el mismo medio de pago utilizado en la compra dentro de los <strong className="text-[var(--color-text)]">7 días hábiles</strong> siguientes a la recepción del producto devuelto. El monto reembolsado corresponderá al precio pagado por el producto; los costos de despacho originales no son reembolsables.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">5. Productos defectuosos o erróneos</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Si recibes un producto con defectos de fabricación o diferente al que pediste, cubre el costo de devolución y te enviaremos el producto correcto o realizaremos el reembolso completo, incluido el costo de envío original. Contáctanos dentro de las <strong className="text-[var(--color-text)]">48 horas</strong> siguientes a la recepción.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">6. Contacto para devoluciones</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Escríbenos a{" "}
            <a href={`mailto:${settings.contact_email}`} className="text-[var(--color-primary)] hover:underline">
              {settings.contact_email}
            </a>{" "}
            o por WhatsApp al{" "}
            <a href={`https://wa.me/${settings.support_whatsapp.replace(/[^\d]/g, "")}`} className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">
              {settings.support_whatsapp}
            </a>{" "}
            indicando en el asunto &quot;Devolución — Orden #XXXX&quot;. Respondemos en un máximo de 24 horas hábiles.
          </p>
        </section>

      </div>
    </main>
  );
}
