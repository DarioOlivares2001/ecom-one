import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return {
    title: "Términos y Condiciones",
    description: `Términos y condiciones de compra en ${settings.store_name}. Precios en CLP, despacho a todo Chile.`,
  };
}

export default async function TerminosPage() {
  const settings = await getStoreSettings();
  const storeName = settings.store_name;
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
        Términos y Condiciones
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Última actualización: abril 2026
      </p>

      <div className="mt-10 flex flex-col gap-10">

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">1. Aceptación de los términos</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Al acceder y realizar una compra en {storeName}, aceptas estos Términos y Condiciones en su totalidad. Si no estás de acuerdo con alguna parte, te pedimos que no utilices nuestra plataforma. Estos términos se rigen por la legislación chilena vigente, en particular la <strong className="text-[var(--color-text)]">Ley 19.496 de Protección al Consumidor</strong>.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">2. Productos y precios</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Todos los precios publicados en el sitio están expresados en <strong className="text-[var(--color-text)]">Pesos Chilenos (CLP)</strong> e incluyen IVA. Nos reservamos el derecho de modificar precios sin previo aviso, sin embargo, el precio aplicable a tu compra será siempre el vigente al momento de confirmar el pago.
          </p>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Las imágenes de los productos son referenciales. Realizamos todos los esfuerzos para que sean lo más representativas posible, pero pueden existir leves variaciones en color según la calibración de cada pantalla.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">3. Proceso de compra</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">El proceso de compra se completa en los siguientes pasos:</p>
          <ol className="ml-5 flex list-decimal flex-col gap-2 text-[var(--color-text-muted)]">
            <li>Selección del producto y variante (talla, color, etc.).</li>
            <li>Agregar al carrito y revisión del resumen.</li>
            <li>Ingreso de datos de contacto y dirección de despacho.</li>
            <li>Pago a través de Flow Chile (WebPay Plus, tarjeta de crédito/débito o transferencia).</li>
            <li>Confirmación de la orden por email.</li>
          </ol>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            La compra se perfecciona únicamente una vez que el pago ha sido confirmado por la plataforma de pagos. En caso de error o rechazo, no se generará cargo alguno.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">4. Medios de pago</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Aceptamos pagos a través de <strong className="text-[var(--color-text)]">Flow Chile</strong>, que habilita los siguientes medios:
          </p>
          <ul className="ml-5 flex list-disc flex-col gap-2 text-[var(--color-text-muted)]">
            <li>WebPay Plus (tarjetas de débito y crédito Visa, Mastercard y Redcompra).</li>
            <li>Transferencia bancaria.</li>
            <li>Otros medios disponibles en la plataforma Flow.</li>
          </ul>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            {storeName} no almacena datos de tarjetas ni información financiera sensible.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">5. Despacho y tiempos de entrega</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Despachamos a todo Chile. Los tiempos estimados de entrega son:
          </p>
          <ul className="ml-5 flex list-disc flex-col gap-2 text-[var(--color-text-muted)]">
            <li><strong className="text-[var(--color-text)]">Región Metropolitana:</strong> 2 a 4 días hábiles.</li>
            <li><strong className="text-[var(--color-text)]">Regiones:</strong> 4 a 7 días hábiles.</li>
            <li><strong className="text-[var(--color-text)]">Zonas extremas (XII, XI, XV):</strong> 7 a 12 días hábiles.</li>
          </ul>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            El despacho es gratuito en compras superiores a $30.000 CLP. Para pedidos menores, el costo de envío es de $3.990 CLP. Los plazos son estimados y pueden verse afectados por eventos de fuerza mayor o alta demanda.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">6. Stock y disponibilidad</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            La disponibilidad de productos se actualiza en tiempo real. Si tras confirmar tu pago un producto no estuviera disponible, te contactaremos a la brevedad para ofrecer una alternativa o reembolso completo.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">7. Modificaciones</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Nos reservamos el derecho de modificar estos Términos y Condiciones en cualquier momento. Las modificaciones entrarán en vigencia desde su publicación en el sitio. El uso continuado de la plataforma implica la aceptación de los términos vigentes.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">8. Contacto</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Para consultas, escríbenos a{" "}
            <a href={`mailto:${settings.contact_email}`} className="text-[var(--color-primary)] hover:underline">
              {settings.contact_email}
            </a>{" "}
            o por WhatsApp al{" "}
            <a href={`https://wa.me/${settings.support_whatsapp.replace(/[^\d]/g, "")}`} className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">
              {settings.support_whatsapp}
            </a>.
          </p>
        </section>

      </div>
    </main>
  );
}
