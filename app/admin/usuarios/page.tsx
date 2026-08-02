import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import { listAdminUsers } from "@/lib/db/repositories/adminUsers";
import { AdminUsersClient } from "./AdminUsersClient";

export const metadata: Metadata = { title: "Usuarios admin — Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function AdminUsuariosPage() {
  const session = getAdminSessionFromCookies();
  if (!session) redirect("/admin/login");
  if (session.role !== "owner") redirect("/admin/dashboard");

  let data;
  try {
    data = await listAdminUsers();
  } catch {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No se pudieron cargar los usuarios admin.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-900">Usuarios admin</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Gestiona accesos administrativos, roles y estado de activación.
        </p>
      </div>
      <AdminUsersClient initialUsers={data as never} />
    </div>
  );
}

