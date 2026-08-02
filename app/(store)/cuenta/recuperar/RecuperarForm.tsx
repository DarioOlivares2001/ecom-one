"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";

const schema = z.object({
  email: z.string().email("Email inválido"),
});

const SUCCESS_MSG =
  "Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.";

export function RecuperarForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Email inválido.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/cuenta/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeClienteEmail(parsed.data.email) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 && typeof data.error === "string") {
          setError(data.error);
          return;
        }
      }
      setDone(true);
    } catch {
      setError("No pudimos enviar la solicitud. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div
        className="mt-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-relaxed text-[var(--color-text)]"
        role="status"
      >
        {SUCCESS_MSG}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error ?? undefined}
      />
      <Button type="submit" size="lg" fullWidth loading={loading}>
        Enviar instrucciones
      </Button>
      <p className="text-center text-sm text-[var(--color-text-muted)]">
        <Link href="/cuenta/login" className="font-medium text-[var(--color-primary)] underline underline-offset-2">
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}
