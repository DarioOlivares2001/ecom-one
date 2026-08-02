"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { MapPin, Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { clsx } from "clsx";

const CHILE_REGIONS = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Metropolitana de Santiago",
  "Libertador General Bernardo O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén del General Carlos Ibáñez del Campo",
  "Magallanes y de la Antártica Chilena",
];

type Dir = {
  id: string;
  nombre: string;
  direccion: string;
  comuna: string;
  region: string;
  referencia: string | null;
  telefono: string | null;
  is_default: boolean;
};

const formSchema = z.object({
  nombre: z.string().min(1, "Nombre de la dirección"),
  direccion: z.string().min(3, "Dirección"),
  comuna: z.string().min(1, "Comuna"),
  region: z.string().min(1, "Región"),
  referencia: z.string().max(300).optional(),
  telefono: z.string().max(40).optional(),
});

function FormSelect({
  label,
  value,
  onChange,
  error,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--color-text)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          "h-10 w-full rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none",
          "focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]",
          error ? "border-[var(--color-error)]" : "border-[var(--color-border)]"
        )}
      >
        {children}
      </select>
      {error ? (
        <p className="text-xs text-[var(--color-error)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const emptyForm = {
  nombre: "",
  direccion: "",
  comuna: "",
  region: "",
  referencia: "",
  telefono: "",
};

export function DireccionesClient() {
  const [list, setList] = useState<Dir[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cuenta/direcciones", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "No se pudieron cargar las direcciones.");
        setList([]);
        return;
      }
      setList(Array.isArray(data.direcciones) ? data.direcciones : []);
    } catch {
      toast.error("Error de conexión.");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setIsDefault((Array.isArray(list) ? list : []).length === 0);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(d: Dir) {
    setEditingId(d.id);
    setForm({
      nombre: d.nombre,
      direccion: d.direccion,
      comuna: d.comuna,
      region: d.region,
      referencia: d.referencia ?? "",
      telefono: d.telefono ?? "",
    });
    setIsDefault(d.is_default);
    setErrors({});
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = formSchema.safeParse({
      ...form,
      referencia: form.referencia.trim() || undefined,
      telefono: form.telefono.trim() || undefined,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const k = String(i.path[0]);
        if (!next[k]) next[k] = i.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        nombre: parsed.data.nombre.trim(),
        direccion: parsed.data.direccion.trim(),
        comuna: parsed.data.comuna.trim(),
        region: parsed.data.region.trim(),
        referencia: parsed.data.referencia?.trim() || null,
        telefono: parsed.data.telefono?.trim() || null,
      };
      if (isDefault) {
        body.is_default = true;
      } else if (editingId) {
        const prev = list.find((x) => x.id === editingId);
        if (prev?.is_default) body.is_default = false;
      }

      if (editingId) {
        const res = await fetch(`/api/cuenta/direcciones/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "No se pudo actualizar.");
          return;
        }
        toast.success("Dirección actualizada.");
      } else {
        const res = await fetch("/api/cuenta/direcciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, is_default: isDefault }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "No se pudo crear.");
          return;
        }
        toast.success("Dirección agregada.");
      }
      closeForm();
      await load();
    } catch {
      toast.error("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id: string) {
    try {
      const res = await fetch(`/api/cuenta/direcciones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "No se pudo actualizar.");
        return;
      }
      toast.success("Dirección principal actualizada.");
      await load();
    } catch {
      toast.error("Error de conexión.");
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta dirección?")) return;
    try {
      const res = await fetch(`/api/cuenta/direcciones/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "No se pudo eliminar.");
        return;
      }
      toast.success("Dirección eliminada.");
      await load();
    } catch {
      toast.error("Error de conexión.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="primary" size="lg" onClick={openNew} className="sm:w-auto">
          Nueva dirección
        </Button>
        <Link href="/cuenta" className="text-sm font-medium text-[var(--color-primary)] underline underline-offset-2">
          Volver a mi cuenta
        </Link>
      </div>

      {showForm ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
            {editingId ? "Editar dirección" : "Agregar dirección"}
          </h2>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <Input
              label="Nombre (ej. Casa, Oficina)"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              error={errors.nombre}
            />
            <Input
              label="Dirección"
              value={form.direccion}
              onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
              error={errors.direccion}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Comuna"
                value={form.comuna}
                onChange={(e) => setForm((f) => ({ ...f, comuna: e.target.value }))}
                error={errors.comuna}
              />
              <FormSelect
                label="Región"
                value={form.region}
                onChange={(v) => setForm((f) => ({ ...f, region: v }))}
                error={errors.region}
              >
                <option value="">Selecciona…</option>
                {CHILE_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </FormSelect>
            </div>
            <Input
              label="Referencia (opcional)"
              value={form.referencia}
              onChange={(e) => setForm((f) => ({ ...f, referencia: e.target.value }))}
            />
            <Input
              label="Teléfono de contacto (opcional)"
              value={form.telefono}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              Marcar como dirección principal
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" size="lg" loading={saving} className="sm:min-w-[140px]">
                Guardar
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={closeForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>
      ) : (Array.isArray(list) ? list : []).length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          No tienes direcciones guardadas. Agrega una para usarla en el checkout.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-clarity-mask="true">
          {list.map((d) => (
            <li
              key={d.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-2">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text)]">
                      {d.nombre}
                      {d.is_default ? (
                        <span className="ml-2 rounded-full bg-[var(--color-primary)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                          Principal
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)]">{d.direccion}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {d.comuna}, {d.region}
                    </p>
                    {d.referencia ? (
                      <p className="text-xs text-[var(--color-text-muted)]">Ref: {d.referencia}</p>
                    ) : null}
                    {d.telefono ? <p className="text-xs text-[var(--color-text-muted)]">Tel: {d.telefono}</p> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {!d.is_default ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void setDefault(d.id)}
                      className="gap-1"
                    >
                      <Star className="h-3.5 w-3.5" />
                      Principal
                    </Button>
                  ) : null}
                  <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(d)} className="gap-1">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void remove(d.id)}
                    className="gap-1 text-[var(--color-error)] hover:bg-[var(--color-error)]/8"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
