import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return {
    title: "Política de Privacidad",
    description: `Cómo ${settings.store_name} recopila, usa y protege tus datos personales conforme a la Ley 19.628.`,
  };
}

export default async function PoliticaPrivacidadPage() {
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
        Política de Privacidad
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Última actualización: abril 2026
      </p>

      <div className="prose-section mt-10 flex flex-col gap-10">

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">1. Responsable del tratamiento</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            {storeName} (en adelante &quot;nosotros&quot; o &quot;la tienda&quot;) es responsable del tratamiento de los datos personales que recopila a través de su sitio web. Operamos conforme a lo dispuesto en la <strong className="text-[var(--color-text)]">Ley 19.628 sobre Protección de la Vida Privada</strong> de la República de Chile.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">2. Datos que recopilamos</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">Al realizar una compra o interactuar con el sitio, podemos recopilar los siguientes datos:</p>
          <ul className="ml-5 flex list-disc flex-col gap-2 text-[var(--color-text-muted)]">
            <li><strong className="text-[var(--color-text)]">Datos de identificación:</strong> nombre completo y correo electrónico.</li>
            <li><strong className="text-[var(--color-text)]">Datos de contacto:</strong> número de teléfono (WhatsApp) y dirección de despacho.</li>
            <li><strong className="text-[var(--color-text)]">Datos de la transacción:</strong> productos adquiridos, monto y número de orden.</li>
            <li><strong className="text-[var(--color-text)]">Datos técnicos:</strong> dirección IP, tipo de navegador y páginas visitadas, recopilados automáticamente con fines estadísticos.</li>
          </ul>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            No almacenamos datos de tarjetas de crédito ni información bancaria. El procesamiento de pagos es gestionado íntegramente por <strong className="text-[var(--color-text)]">Flow Chile</strong>.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">3. Finalidad del tratamiento</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">Utilizamos tus datos exclusivamente para:</p>
          <ul className="ml-5 flex list-disc flex-col gap-2 text-[var(--color-text-muted)]">
            <li>Procesar y confirmar tus pedidos.</li>
            <li>Coordinar el despacho y entrega de los productos.</li>
            <li>Enviarte comunicaciones relacionadas con tu compra (confirmación, despacho, soporte).</li>
            <li>Mejorar nuestros servicios y experiencia de usuario.</li>
            <li>Cumplir con obligaciones legales y tributarias.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">4. Transferencia de datos a terceros</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            No vendemos ni cedemos tus datos personales a terceros con fines comerciales. Solo compartimos información estrictamente necesaria con:
          </p>
          <ul className="ml-5 flex list-disc flex-col gap-2 text-[var(--color-text-muted)]">
            <li><strong className="text-[var(--color-text)]">Flow Chile</strong> — procesamiento de pagos.</li>
            <li><strong className="text-[var(--color-text)]">Empresas de courier</strong> — despacho y seguimiento de pedidos.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">5. Derechos del titular</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Conforme a la Ley 19.628, tienes derecho a <strong className="text-[var(--color-text)]">acceder, rectificar, cancelar y oponerte</strong> al tratamiento de tus datos personales (derechos ARCO). Para ejercer estos derechos, contáctanos por los canales indicados a continuación.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">6. Seguridad</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Adoptamos medidas técnicas y organizativas razonables para proteger tus datos frente a accesos no autorizados, pérdida o destrucción. Las transacciones se realizan sobre conexiones cifradas (SSL/TLS).
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--color-text)]">7. Contacto</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Para consultas sobre esta política o para ejercer tus derechos, escríbenos a{" "}
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
