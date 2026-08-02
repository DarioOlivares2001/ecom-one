import dotenv from "dotenv";
import { hash } from "bcryptjs";
import { createAdminClient } from "../lib/supabase/admin";

dotenv.config({ path: ".env.local" });
dotenv.config();

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((v) => v.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }

  const emailRaw = getArg("email") || process.env.ADMIN_SEED_EMAIL || "";
  const password = getArg("password") || process.env.ADMIN_SEED_PASSWORD || "";
  const role = getArg("role") || process.env.ADMIN_SEED_ROLE || "admin";

  const email = emailRaw.trim().toLowerCase();
  if (!email || !password) {
    console.error("Uso: npx tsx scripts/create-admin-user.ts --email=admin@dominio.com --password=secreto");
    console.error("O define ADMIN_SEED_EMAIL y ADMIN_SEED_PASSWORD temporalmente.");
    process.exit(1);
  }

  const password_hash = await hash(password, 12);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { error } = await admin.from("admin_users").upsert(
    {
      email,
      password_hash,
      role,
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );

  if (error) {
    console.error("[create-admin-user] error:", error.message);
    process.exit(1);
  }

  console.log(`[create-admin-user] OK: ${email} (${role})`);
}

void main();

