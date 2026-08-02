import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function SeguimientoNotFound({ displayCode }: { displayCode: string }) {
  return (
    <section className="mx-auto w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-sm sm:p-10">
      <p className="font-display text-lg font-semibold text-[var(--color-text)]">
        No encontramos el pedido {displayCode}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
        Revisa el código en el correo de confirmación o intenta de nuevo. Si acabas de pagar, puede tardar unos
        minutos en aparecer.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/seguimiento" className="w-full sm:w-auto">
          <Button variant="secondary" size="lg" fullWidth className="sm:min-w-[200px]">
            Buscar otro pedido
          </Button>
        </Link>
        <Link href="/productos" className="w-full sm:w-auto">
          <Button variant="primary" size="lg" fullWidth className="sm:min-w-[200px]">
            Ir a productos
          </Button>
        </Link>
      </div>
    </section>
  );
}
