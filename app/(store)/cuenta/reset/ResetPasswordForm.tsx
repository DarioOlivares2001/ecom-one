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

const schema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres"),
    confirm: z.string().min(1, "Confirma tu contraseña"),
  })
  .refine((d) => d.password === d.confirm, { message: "Las contraseñas no coinciden", path: ["confirm"] });

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});

  if (!token) {
    return (
      <div className="mt-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm text-[var(--color-text)]">
        <p>El enlace no es válido o está incompleto.</p>
        <p className="mt-3">
          <Link href="/cuenta/recuperar" className="font-medium text-[var(--color-primary)] underline underline-offset-2">
            Solicitar nuevo enlace
          </Link>
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const next: typeof fieldErrors = {};
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
      const res = await fetch("/api/cuenta/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: parsed.data.password,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "No se pudo actualizar la contraseña.");
        return;
      }

      if (!data.ok || typeof data.email !== "string" || !data.email) {
        toast.error("Respuesta inesperada del servidor.");
        return;
      }

      const emailNorm = normalizeClienteEmail(data.email);
      const loginRes = await fetch("/api/cuenta/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailNorm,
          password: parsed.data.password,
        }),
      });

      if (loginRes.ok) {
        dispatchClienteSessionChanged();
        toast.success("Contraseña actualizada. Ya iniciaste sesión.");
        router.push("/cuenta");
        router.refresh();
        return;
      }

      toast.success("Contraseña actualizada. Inicia sesión con tu correo.");
      router.push("/cuenta/login");
      router.refresh();
    } catch {
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      <Input
        label="Nueva contraseña"
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
        Actualizar contraseña
      </Button>
      <p className="text-center text-sm text-[var(--color-text-muted)]">
        <Link href="/cuenta/login" className="font-medium text-[var(--color-primary)] underline underline-offset-2">
          Ir al inicio de sesión
        </Link>
      </p>
    </form>
  );
}
