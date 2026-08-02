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
  const session = getAdminSessionFromCookies();
  if (!isLoginRoute && !session) {
    redirect("/admin/login");
  }

  const settings = await getStoreSettings();

  return (
    <div className={`min-h-screen bg-zinc-100 ${poppinsAdmin.className}`}>
      {!isLoginRoute ? <AdminSidebar settings={settings} adminRole={session?.role ?? "admin"} /> : null}
      <div className={!isLoginRoute ? "lg:pl-64" : undefined}>
        <main className="min-h-screen p-6 pt-20 lg:pt-6">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
