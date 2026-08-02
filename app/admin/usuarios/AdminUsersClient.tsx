"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";

type AdminRole = "owner" | "admin" | "operator";
type AdminUser = {
  id: string;
  email: string;
  role: AdminRole;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
};

function fmtDate(v: string | null): string {
  if (!v) return "Nunca";
  try {
    return new Date(v).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export function AdminUsersClient({ initialUsers }: { initialUsers: AdminUser[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AdminRole>("admin");
  const [newActive, setNewActive] = useState(true);

  const ownersActiveCount = useMemo(
    () => users.filter((u) => u.role === "owner" && u.active).length,
    [users]
  );

  async function refreshList() {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.users)) {
      setUsers(data.users as AdminUser[]);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          role: newRole,
          active: newActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "No se pudo crear el usuario admin.");
        return;
      }
      setNewEmail("");
      setNewPassword("");
      setNewRole("admin");
      setNewActive(true);
      toast.success("Usuario admin creado correctamente.");
      await refreshList();
      router.refresh();
    } catch {
      toast.error("Error de conexión.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function saveUser(id: string, role: AdminRole, active: boolean) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role, active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "No se pudo guardar.");
        return;
      }
      toast.success("Usuario actualizado.");
      await refreshList();
      router.refresh();
    } catch {
      toast.error("Error de conexión.");
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(id: string, password: string) {
    if (!password) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "No se pudo resetear contraseña.");
        return;
      }
      toast.success("Contraseña reseteada correctamente.");
    } catch {
      toast.error("Error de conexión.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-zinc-900">Crear usuario admin</h2>
        <form onSubmit={createUser} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700">Email</span>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700">Password temporal</span>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300"
              minLength={8}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700">Rol</span>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AdminRole)}
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300"
            >
              <option value="owner">owner</option>
              <option value="admin">admin</option>
              <option value="operator">operator</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm text-zinc-700">
            <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} />
            Activo
          </label>
          <button
            type="submit"
            disabled={createLoading}
            className="sm:col-span-2 inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createLoading ? "Creando..." : "Crear usuario admin"}
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-zinc-50">
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Activo</th>
                <th className="px-4 py-3">Último login</th>
                <th className="px-4 py-3">Creado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u) => (
                <AdminUserRow
                  key={u.id}
                  user={u}
                  ownersActiveCount={ownersActiveCount}
                  busy={busyId === u.id}
                  onSave={saveUser}
                  onResetPassword={resetPassword}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AdminUserRow({
  user,
  busy,
  ownersActiveCount,
  onSave,
  onResetPassword,
}: {
  user: AdminUser;
  busy: boolean;
  ownersActiveCount: number;
  onSave: (id: string, role: AdminRole, active: boolean) => Promise<void>;
  onResetPassword: (id: string, password: string) => Promise<void>;
}) {
  const [role, setRole] = useState<AdminRole>(user.role);
  const [active, setActive] = useState<boolean>(user.active);
  const [tmpPass, setTmpPass] = useState("");
  const isOnlyActiveOwner = user.role === "owner" && user.active && ownersActiveCount <= 1;
  const disableRoleOwnerDowngrade = isOnlyActiveOwner && role !== "owner";
  const disableActiveOff = isOnlyActiveOwner && !active;

  return (
    <tr className="align-top">
      <td className="px-4 py-3 text-zinc-800">{user.email}</td>
      <td className="px-4 py-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as AdminRole)}
          className="h-9 rounded-md border border-zinc-300 px-2 text-sm"
        >
          <option value="owner">owner</option>
          <option value="admin">admin</option>
          <option value="operator">operator</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span className="text-zinc-700">{active ? "Sí" : "No"}</span>
        </label>
      </td>
      <td className="px-4 py-3 text-zinc-600">{fmtDate(user.last_login_at)}</td>
      <td className="px-4 py-3 text-zinc-600">{fmtDate(user.created_at)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            disabled={busy || disableRoleOwnerDowngrade || disableActiveOff}
            onClick={() => void onSave(user.id, role, active)}
            className="inline-flex h-8 items-center justify-center rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Guardar
          </button>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tmpPass}
              onChange={(e) => setTmpPass(e.target.value)}
              placeholder="Nueva pass"
              className="h-8 w-28 rounded-md border border-zinc-300 px-2 text-xs"
              minLength={8}
            />
            <button
              type="button"
              disabled={busy || tmpPass.length < 8}
              onClick={() => void onResetPassword(user.id, tmpPass).then(() => setTmpPass(""))}
              className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset pass
            </button>
          </div>
          {isOnlyActiveOwner ? (
            <p className="text-[11px] text-amber-700">Es el último owner activo.</p>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

