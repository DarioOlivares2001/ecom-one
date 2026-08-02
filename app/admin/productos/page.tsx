import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, PackageOpen } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeProductCategory } from "@/lib/product/categories";
import { formatPrice } from "@/lib/utils/format";
import {
  ArchiveProductButton,
  RestoreProductButton,
} from "@/components/admin/ProductAdminButtons";

export const metadata: Metadata = { title: "Productos — Admin" };

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Tab = "active" | "inactive" | "archived";

async function getProductsByTab(tab: Tab) {
  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("products")
      .select(
        "id, name, slug, price, compare_at_price, stock, category, images, active, deleted_at, created_at"
      )
      .order("created_at", { ascending: false });

    if (tab === "active")   query = query.eq("active", true).is("deleted_at", null);
    if (tab === "inactive") query = query.eq("active", false).is("deleted_at", null);
    if (tab === "archived") query = query.not("deleted_at", "is", null);

    const { data } = await query;
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const tab = (["active", "inactive", "archived"].includes(searchParams?.tab ?? "")
    ? searchParams!.tab
    : "active") as Tab;

  const products = await getProductsByTab(tab);

  const tabCls = (t: Tab) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? "border-zinc-900 text-zinc-900"
        : "border-transparent text-zinc-500 hover:text-zinc-700"
    }`;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-900">Productos</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{products.length} en esta vista</p>
        </div>
        <Link
          href="/admin/productos/nuevo"
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-0 flex border-b border-zinc-200">
        <Link href="/admin/productos?tab=active"   className={tabCls("active")}>Activos</Link>
        <Link href="/admin/productos?tab=inactive" className={tabCls("inactive")}>Inactivos</Link>
        <Link href="/admin/productos?tab=archived" className={tabCls("archived")}>Archivados</Link>
      </div>

      {/* Empty state */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-b-xl border border-t-0 border-zinc-200 bg-white py-24 text-center">
          <PackageOpen className="h-12 w-12 text-zinc-300" strokeWidth={1} />
          <div>
            <p className="font-semibold text-zinc-700">
              {tab === "archived" ? "Sin productos archivados" : "Sin productos aquí"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {tab === "active"
                ? "Crea tu primer producto para empezar a vender."
                : tab === "inactive"
                ? "No hay productos inactivos."
                : "Los productos que archives aparecerán aquí."}
            </p>
          </div>
          {tab === "active" && (
            <Link
              href="/admin/productos/nuevo"
              className="mt-2 flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              <Plus className="h-4 w-4" />
              Crear producto
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-b-xl border border-t-0 border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Precio</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {products.map((p: any) => (
                  <tr key={p.id} className="transition-colors hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                          {p.images?.[0] ? (
                            <Image
                              src={p.images[0]}
                              alt={p.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <PackageOpen className="h-4 w-4 text-zinc-300" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-900">{p.name}</p>
                          <p className="truncate text-xs text-zinc-400">{p.slug}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">{formatPrice(p.price)}</p>
                      {p.compare_at_price && (
                        <p className="text-xs text-zinc-400 line-through">
                          {formatPrice(p.compare_at_price)}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={
                          p.stock === 0
                            ? "font-semibold text-red-500"
                            : p.stock <= 5
                            ? "font-semibold text-amber-500"
                            : "text-zinc-700"
                        }
                      >
                        {p.stock}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-zinc-600">
                      {normalizeProductCategory(p.category) || "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          tab === "archived"
                            ? "bg-orange-50 text-orange-700"
                            : p.active
                            ? "bg-green-50 text-green-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            tab === "archived"
                              ? "bg-orange-400"
                              : p.active
                              ? "bg-green-500"
                              : "bg-zinc-400"
                          }`}
                        />
                        {tab === "archived" ? "Archivado" : p.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {tab !== "archived" && (
                          <Link
                            href={`/admin/productos/${p.id}`}
                            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Link>
                        )}
                        {tab === "archived" ? (
                          <RestoreProductButton id={p.id} name={p.name} />
                        ) : (
                          <ArchiveProductButton id={p.id} name={p.name} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
