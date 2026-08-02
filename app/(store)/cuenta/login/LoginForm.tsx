"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CuentaPasswordToggleSuffix } from "@/components/cuenta/CuentaPasswordToggleSuffix";
import { toast } from "@/components/ui/Toast";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
import { dispatchClienteSessionChanged } from "@/lib/cuenta/session-events";
import { getSafePostLoginRedirect } from "@/lib/cuenta/safeRedirect";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const next: { email?: string; password?: string } = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof typeof next;
        next[field] = issue.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch("/api/cuenta/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeClienteEmail(parsed.data.email),
          password: parsed.data.password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "No se pudo iniciar sesión.");
        return;
      }
      dispatchClienteSessionChanged();
      const next = getSafePostLoginRedirect(searchParams.get("redirect"), "/");
      router.push(next);
      router.refresh();
    } catch {
      toast.error("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <Input
        label="Contraseña"
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        suffix={
          <CuentaPasswordToggleSuffix
            visible={showPassword}
            onToggle={() => setShowPassword((prev) => !prev)}
          />
        }
      />
      <p className="text-right text-sm">
        <Link
          href="/cuenta/recuperar"
          className="font-medium text-[var(--color-primary)] underline underline-offset-2 hover:opacity-90"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
      <Button type="submit" size="lg" fullWidth loading={loading}>
        Iniciar sesión
      </Button>
      <Link
        href="/cuenta/registro"
        className="inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-base font-medium text-[var(--color-text)] transition-all duration-[var(--transition-fast)] select-none hover:bg-[var(--color-background)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:ring-offset-2"
      >
        Crear cuenta
      </Link>
      <p className="text-center text-xs leading-relaxed text-[var(--color-text-muted)]">
        ¿Aún no tienes cuenta? Crea una cuenta gratis y accede a beneficios exclusivos
      </p>
    </form>
  );
}
