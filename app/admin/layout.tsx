import { Poppins } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Toaster } from "@/components/ui/Toast";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { getAdminSessionFromCookies } from "@/lib/admin/session";

const poppinsAdmin = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const currentPath = headers().get("x-pathname") || headers().get("next-url") || "";
  const isLoginRoute = currentPath.startsWith("/admin/login");
  // Asistente "Crear producto con IA": pantalla completa, sin el sidebar del
  // admin, para dejarle más espacio al asistente de 3 pasos.
  const isFullScreenRoute = currentPath.startsWith("/admin/productos/crear-con-ia");
  const hideSidebar = isLoginRoute || isFullScreenRoute;
  const session = getAdminSessionFromCookies();
  if (!isLoginRoute && !session) {
    redirect("/admin/login");
  }

  const settings = await getStoreSettings();

  return (
    <div className={`min-h-screen bg-zinc-100 ${poppinsAdmin.className}`}>
      {!hideSidebar ? <AdminSidebar settings={settings} adminRole={session?.role ?? "admin"} /> : null}
      <div className={!hideSidebar ? "lg:pl-64" : undefined}>
        <main className={isLoginRoute ? "min-h-screen" : "min-h-screen p-6 pt-20 lg:pt-6"}>
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
