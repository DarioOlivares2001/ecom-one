import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Cliente } from "@/lib/supabase/types";
import { formatPrice } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Clientes — Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** Asegura variables de entorno del rol de servicio en runtime Node (no Edge). */
export const runtime = "nodejs";

type AdminClienteRow = Pick<
  Cliente,
  "id" | "nombre" | "email" | "telefono" | "comuna" | "total_orders" | "total_spent" | "last_order_at"
>;

async function getClientes(): Promise<{ clientes: AdminClienteRow[]; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    console.error("[admin-clientes] error", {
      reason: "faltan variables de entorno",
      hasUrl: Boolean(url),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      hint: "Configura SUPABASE_SERVICE_ROLE_KEY (no uses la anon key).",
    });
    return {
      clientes: [],
      error: "No se pudieron cargar los clientes desde Supabase.",
    };
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("clientes")
      .select("id, nombre, email, telefono, comuna, total_orders, total_spent, last_order_at")
      .order("last_order_at", { ascending: false });

    if (error) {
      console.error("[admin-clientes] error", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return {
        clientes: [],
        error: "No se pudieron cargar los clientes desde Supabase.",
      };
    }

    return { clientes: data ?? [], error: null };
  } catch (err) {
    console.error("[admin-clientes] error", { phase: "excepción", err });
    return {
      clientes: [],
      error: "Error inesperado al cargar clientes.",
    };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default async function AdminClientesPage() {
  const { clientes, error } = await getClientes();

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-900">Clientes</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Perfiles derivados de pedidos (email normalizado). Ordenados por último pedido.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Teléfono</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Comuna</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-700">Pedidos</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-700">Total gastado</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Último pedido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                    Aún no hay clientes registrados. Se crearán al completar pedidos desde el checkout.
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900">{c.nombre}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-zinc-600" title={c.email}>
                      {c.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600">{c.telefono ?? "—"}</td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-zinc-600" title={c.comuna ?? ""}>
                      {c.comuna ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-zinc-900">
                      {c.total_orders}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-zinc-900">
                      {formatPrice(c.total_spent)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600">{formatDate(c.last_order_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
