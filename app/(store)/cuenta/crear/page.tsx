"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CuentaPasswordToggleSuffix } from "@/components/cuenta/CuentaPasswordToggleSuffix";
import { toast } from "@/components/ui/Toast";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";

const schema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres"),
    confirm: z.string().min(1, "Confirma tu contraseña"),
  })
  .refine((d) => d.password === d.confirm, { message: "Las contraseñas no coinciden", path: ["confirm"] });

const STORAGE_BIENVENIDA = "cuenta_bienvenida_payload";

function CrearCuentaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailRaw = searchParams.get("email") ?? "";
  const orderRaw = searchParams.get("order") ?? "";

  const emailNorm = useMemo(() => normalizeClienteEmail(emailRaw), [emailRaw]);
  const orderNum = useMemo(() => {
    const n = Number(String(orderRaw).trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [orderRaw]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});

  const emailValid = z.string().email().safeParse(emailNorm).success && orderNum != null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValid || !orderNum) {
      toast.error("Enlace incompleto. Vuelve desde la confirmación de tu pedido.");
      return;
    }

    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const next: { password?: string; confirm?: string } = {};
      parsed.error.issues.forEach((issue) => {
        const k = issue.path[0] as keyof typeof next;
        if (k === "password" || k === "confirm") next[k] = issue.message;
      });
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      const res = await fetch("/api/cuenta/registro-post-compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailNorm,
          password: parsed.data.password,
          order: orderNum,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "No se pudo crear la cuenta.");
        return;
      }

      if (data.ok) {
        const nombreOk = typeof data.nombre === "string" ? data.nombre.trim() : "";
        try {
          sessionStorage.setItem(
            STORAGE_BIENVENIDA,
            JSON.stringify({ nombre: nombreOk || undefined, email: emailNorm })
          );
        } catch {
          // ignore
        }
        const recoveryPast = Boolean((data as { recoveryHadPastOrders?: boolean }).recoveryHadPastOrders);
        const qs = new URLSearchParams();
        if (nombreOk) qs.set("nombre", nombreOk);
        qs.set("email", emailNorm);
        if (recoveryPast) qs.set("recovery", "1");
        router.push(`/cuenta/bienvenida?${qs.toString()}`);
        return;
      }

      toast.error("Respuesta inesperada del servidor.");
    } catch {
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (!emailValid) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Crear cuenta</h1>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Este enlace no es válido o ha expirado. Usa el botón desde la página de confirmación de tu pedido o
          contacta a soporte.
        </p>
        <Link href="/" className="mt-8">
          <Button variant="secondary">Volver al inicio</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Crea tu cuenta</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Completa tu registro con la misma dirección de correo que usaste en tu compra.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Input label="Email" type="email" value={emailNorm} readOnly aria-readonly />
        <Input
          label="Contraseña"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          suffix={
            <CuentaPasswordToggleSuffix
              visible={showPassword}
              onToggle={() => setShowPassword((p) => !p)}
            />
          }
        />
        <Input
          label="Confirmar contraseña"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={fieldErrors.confirm}
          suffix={
            <CuentaPasswordToggleSuffix
              visible={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((p) => !p)}
            />
          }
        />
        <Button type="submit" size="lg" fullWidth loading={loading}>
          Crear mi cuenta
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
        <Link href="/" className="underline underline-offset-2 hover:text-[var(--color-text)]">
          Volver a la tienda
        </Link>
      </p>
    </main>
  );
}

export default function CrearCuentaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--color-text-muted)]">
          Cargando…
        </div>
      }
    >
      <CrearCuentaForm />
    </Suspense>
  );
}
