"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { dispatchClienteSessionChanged } from "@/lib/cuenta/session-events";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoading(true);
    try {
      const res = await fetch("/api/cuenta/logout", { method: "POST" });
      if (!res.ok) {
        toast.error("No se pudo cerrar sesión.");
        return;
      }
      dispatchClienteSessionChanged();
      router.push("/cuenta/login");
      router.refresh();
    } catch {
      toast.error("Error de conexión al cerrar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="lg" loading={loading} onClick={handleLogout}>
      Cerrar sesión
    </Button>
  );
}
