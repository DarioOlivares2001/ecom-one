import dotenv from "dotenv";
import { hash } from "bcryptjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((v) => v.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("Falta DATABASE_URL en .env.local (conexión a Neon).");
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
  if (role !== "owner" && role !== "admin" && role !== "operator") {
    console.error(`Rol inválido: "${role}". Debe ser owner, admin u operator.`);
    process.exit(1);
  }

  const password_hash = await hash(password, 12);

  // Import diferido: recién acá se resuelve DATABASE_URL (ya validado arriba).
  const { upsertAdminUserByEmail } = await import("../lib/db/repositories/adminUsers");

  try {
    await upsertAdminUserByEmail({ email, password_hash, role, active: true });
  } catch (error) {
    console.error("[create-admin-user] error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log(`[create-admin-user] OK: ${email} (${role})`);
}

void main();
