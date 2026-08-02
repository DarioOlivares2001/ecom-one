import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function SeguimientoLookupForm({
  invalidCode,
  requiresEmail = false,
  prefillOrderCode,
  showMisPedidosLink,
}: {
  /** true si había query `order` pero no era un código SO válido */
  invalidCode?: boolean;
  /** Sin sesión activa: pedir email además del código */
  requiresEmail?: boolean;
  /** Pre-carga el código cuando el usuario ya lo envió pero faltaba el email */
  prefillOrderCode?: string;
  showMisPedidosLink?: boolean;
}) {
  return (
    <section className="mx-auto w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Seguimiento de pedido</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
        {requiresEmail
          ? "Ingresa el código de tu pedido y el email con que compraste para ver el estado."
          : "Ingresa el código que recibiste por correo al confirmar tu compra para ver el estado y los detalles."}
      </p>

      <form method="get" action="/seguimiento" className="mt-8 flex flex-col gap-4">
        <Input
          id="seguimiento-order"
          name="order"
          type="text"
          autoComplete="off"
          placeholder="Ej: SO00000086"
          label="Código de pedido"
          defaultValue={prefillOrderCode ?? ""}
          required
          className="font-mono"
        />
        {requiresEmail && (
          <Input
            id="seguimiento-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            label="Email con que compraste"
            required
          />
        )}
        {invalidCode ? (
          <p className="text-xs text-[var(--color-error)]" role="alert">
            Escribe un código de pedido válido (comienza con SO seguido de números, ej: SO00000086).
          </p>
        ) : null}
        <Button type="submit" size="lg" fullWidth>
          Buscar pedido
        </Button>
      </form>

      {showMisPedidosLink && (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            ¿Tienes cuenta?{" "}
            <Link href="/cuenta/pedidos" className="font-medium text-[var(--color-primary)] underline underline-offset-2">
              Ver mis pedidos
            </Link>
          </p>
        </div>
      )}

      <p className="mt-8 text-center text-sm text-[var(--color-text-muted)]">
        <Link href="/productos" className="font-medium text-[var(--color-primary)] underline underline-offset-2">
          Volver a la tienda
        </Link>
      </p>
    </section>
  );
}
