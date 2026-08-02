"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CuentaPasswordToggleSuffix } from "@/components/cuenta/CuentaPasswordToggleSuffix";
import { toast } from "@/components/ui/Toast";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
import { dispatchClienteSessionChanged } from "@/lib/cuenta/session-events";

const STORAGE_BIENVENIDA = "cuenta_bienvenida_payload";

const schema = z
  .object({
    nombre: z.string().min(2, "Ingresa tu nombre"),
    email: z.string().email("Email inválido"),
    telefono: z.string().max(40).optional(),
    password: z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres"),
    confirm: z.string().min(1, "Confirma tu contraseña"),
  })
  .refine((d) => d.password === d.confirm, { message: "Las contraseñas no coinciden", path: ["confirm"] });

export default function CuentaRegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    nombre?: string;
    email?: string;
    telefono?: string;
    password?: string;
    confirm?: string;
  }>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      nombre,
      email,
      telefono: telefono.trim() || undefined,
      password,
      confirm,
    });
    if (!parsed.success) {
      const next: typeof fieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const k = issue.path[0] as keyof typeof next;
        if (k === "nombre" || k === "email" || k === "telefono" || k === "password" || k === "confirm") {
          if (!next[k]) next[k] = issue.message;
        }
      });
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const res = await fetch("/api/cuenta/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: parsed.data.nombre.trim(),
          email: normalizeClienteEmail(parsed.data.email),
          telefono: parsed.data.telefono?.trim() || null,
          password: parsed.data.password,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "No se pudo crear la cuenta.");
        return;
      }

      if (!data.ok || !data.storeName) {
        toast.error("Respuesta inesperada del servidor.");
        return;
      }

      const recoveryPast = Boolean((data as { recoveryHadPastOrders?: boolean }).recoveryHadPastOrders);

      const loginRes = await fetch("/api/cuenta/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeClienteEmail(parsed.data.email),
          password: parsed.data.password,
        }),
      });
      if (!loginRes.ok) {
        toast.error("Cuenta creada, pero no se pudo iniciar sesión automáticamente. Intenta entrar con tu correo.");
        router.push("/cuenta/login");
        return;
      }

      dispatchClienteSessionChanged();
      toast.success(`¡Ya eres parte de ${data.storeName}!`);

      try {
        sessionStorage.setItem(
          STORAGE_BIENVENIDA,
          JSON.stringify({
            nombre: String(data.nombre ?? "").trim() || undefined,
            email: normalizeClienteEmail(parsed.data.email),
          })
        );
      } catch {
        // ignore
      }

      const qs = new URLSearchParams();
      qs.set("nombre", String(data.nombre ?? "").trim() || "Cliente");
      qs.set("email", normalizeClienteEmail(parsed.data.email));
      if (recoveryPast) qs.set("recovery", "1");
      router.push(`/cuenta/bienvenida?${qs.toString()}`);
      router.refresh();
    } catch {
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Crear cuenta</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Regístrate gratis con tu correo. No necesitas comprar para tener cuenta.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Input
          label="Nombre"
          type="text"
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={fieldErrors.nombre}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <Input
          label="Teléfono (opcional)"
          type="tel"
          autoComplete="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          error={fieldErrors.telefono}
        />
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
              onToggle={() => setShowPassword((prev) => !prev)}
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
              onToggle={() => setShowConfirmPassword((prev) => !prev)}
            />
          }
        />
        <Button type="submit" size="lg" fullWidth loading={loading}>
          Crear cuenta
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
        ¿Ya tienes cuenta?{" "}
        <Link href="/cuenta/login" className="font-medium text-[var(--color-primary)] underline underline-offset-2">
          Iniciar sesión
        </Link>
      </p>
    </main>
  );
}
