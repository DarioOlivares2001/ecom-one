import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "./AdminLoginForm";
import { getAdminSessionFromCookies } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "Login Admin",
};

export default function AdminLoginPage() {
  if (getAdminSessionFromCookies()) {
    redirect("/admin/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <AdminLoginForm />
    </main>
  );
}

