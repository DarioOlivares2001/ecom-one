"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CuentaPasswordToggleSuffix } from "@/components/cuenta/CuentaPasswordToggleSuffix";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo iniciar sesión.");
        return;
      }
      router.push("/admin/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        Inicia sesión
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
        <Input
          label="Contraseña"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
          suffix={
            <CuentaPasswordToggleSuffix visible={showPassword} onToggle={() => setShowPassword((prev) => !prev)} />
          }
        />
      </div>

      {error ? (
        <p className="mt-4 text-sm font-medium text-[var(--color-error)]" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth loading={loading} className="mt-6">
        {loading ? "Ingresando…" : "Ingresar al panel"}
      </Button>
    </form>
  );
}
