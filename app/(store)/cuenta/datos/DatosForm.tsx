"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import {
  validateNombreCliente,
  validateTelefonoChileno,
  validateRutCampos,
} from "@/lib/clientes/datosClienteValidators";
import { rutNumeroSoloDigitos } from "@/lib/clientes/rutChileno";

export type DatosIniciales = {
  nombre: string;
  email: string;
  telefono: string;
  rut_numero: string;
  rut_dv: string;
};

type FieldErrors = {
  nombre?: string;
  telefono?: string;
  rut_numero?: string;
  rut_dv?: string;
};

function strictFieldErrors(
  nombre: string,
  telefono: string,
  rutNumero: string,
  rutDv: string
): FieldErrors {
  const out: FieldErrors = {};
  const ne = validateNombreCliente(nombre);
  if (ne) out.nombre = ne;
  const te = validateTelefonoChileno(telefono);
  if (te) out.telefono = te;
  const re = validateRutCampos(rutNumero, rutDv);
  if (re.rut_numero) out.rut_numero = re.rut_numero;
  if (re.rut_dv) out.rut_dv = re.rut_dv;
  return out;
}

function displayFieldErrors(
  nombre: string,
  telefono: string,
  rutNumero: string,
  rutDv: string,
  touched: { nombre: boolean; telefono: boolean; rut: boolean },
  submitAttempted: boolean
): FieldErrors {
  const out: FieldErrors = {};
  const showNombre = touched.nombre || submitAttempted || nombre.length > 0;
  if (showNombre) {
    const ne = validateNombreCliente(nombre);
    if (ne) out.nombre = ne;
  }
  const showTel = touched.telefono || submitAttempted || telefono.trim().length > 0;
  if (showTel) {
    const te = validateTelefonoChileno(telefono);
    if (te) out.telefono = te;
  }
  const showRut = touched.rut || submitAttempted || rutNumero.length > 0 || rutDv.length > 0;
  if (showRut) {
    const re = validateRutCampos(rutNumero, rutDv);
    if (re.rut_numero) out.rut_numero = re.rut_numero;
    if (re.rut_dv) out.rut_dv = re.rut_dv;
  }
  return out;
}

export function DatosForm({ initial }: { initial: DatosIniciales }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(initial.nombre);
  const [telefono, setTelefono] = useState(initial.telefono);
  const [rutNumero, setRutNumero] = useState(initial.rut_numero);
  const [rutDv, setRutDv] = useState(initial.rut_dv);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ nombre: false, telefono: false, rut: false });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const strictErrors = useMemo(
    () => strictFieldErrors(nombre, telefono, rutNumero, rutDv),
    [nombre, telefono, rutNumero, rutDv]
  );

  /** Errores al blur / al escribir; si el guardado está bloqueado, rellena con strict para que se vea por qué. */
  const displayErrors = useMemo(() => {
    const soft = displayFieldErrors(nombre, telefono, rutNumero, rutDv, touched, submitAttempted);
    const out: FieldErrors = { ...soft };
    (Object.keys(strictErrors) as (keyof FieldErrors)[]).forEach((k) => {
      if (strictErrors[k] && !out[k]) out[k] = strictErrors[k];
    });
    return out;
  }, [nombre, telefono, rutNumero, rutDv, touched, submitAttempted, strictErrors]);

  const hasBlockingErrors = Object.keys(strictErrors).length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    const err = strictFieldErrors(nombre, telefono, rutNumero, rutDv);
    if (Object.keys(err).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/cuenta/datos", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          rut_numero: rutNumero.trim() || null,
          rut_dv: rutDv.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "No se pudo guardar.");
        return;
      }
      toast.success("Tus datos se guardaron correctamente.");
      router.refresh();
    } catch {
      toast.error("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      <Input
        label="Nombre"
        type="text"
        autoComplete="name"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, nombre: true }))}
        error={displayErrors.nombre}
      />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        value={initial.email}
        readOnly
        className="cursor-default border-[var(--color-border)]/90 bg-[var(--color-background)]/90 text-[var(--color-text-muted)]"
      />
      <p className="-mt-2 text-xs text-[var(--color-text-muted)]">El correo no se puede cambiar por ahora.</p>
      <Input
        label="Teléfono"
        type="tel"
        autoComplete="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, telefono: true }))}
        error={displayErrors.telefono}
        helperText={!displayErrors.telefono ? "Ejemplo: +56 9 3572 2190" : undefined}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <Input
          label="RUT (número, opcional)"
          placeholder="12345678"
          inputMode="numeric"
          autoComplete="off"
          value={rutNumero}
          onChange={(e) => setRutNumero(rutNumeroSoloDigitos(e.target.value).slice(0, 8))}
          onBlur={() => setTouched((t) => ({ ...t, rut: true }))}
          error={displayErrors.rut_numero}
        />
        <Input
          label="DV"
          placeholder="K"
          className="sm:max-w-[5rem]"
          inputMode="text"
          autoComplete="off"
          value={rutDv}
          onChange={(e) => {
            const v = e.target.value.toUpperCase().replace(/[^0-9K]/g, "").slice(0, 1);
            setRutDv(v);
          }}
          onBlur={() => setTouched((t) => ({ ...t, rut: true }))}
          error={displayErrors.rut_dv}
        />
      </div>
      <Button type="submit" size="lg" fullWidth loading={loading} disabled={hasBlockingErrors}>
        Guardar cambios
      </Button>
      <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] p-4">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Direcciones de entrega</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Administra tus direcciones para comprar mas rapido.
        </p>
        <Link
          href="/cuenta/direcciones"
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-background)] sm:w-auto"
        >
          Mis direcciones
        </Link>
      </section>
      <Link
        href="/cuenta"
        className="text-center text-sm font-medium text-[var(--color-primary)] underline underline-offset-2"
      >
        Volver a mi cuenta
      </Link>
    </form>
  );
}
