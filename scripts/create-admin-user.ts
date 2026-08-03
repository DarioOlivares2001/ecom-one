/**
 * Crea (o actualiza, con confirmación explícita) un usuario admin en Neon.
 * Interactivo a propósito: pide email, contraseña (oculta) y rol por consola.
 * Nunca imprime la contraseña, su hash, ni DATABASE_URL.
 *
 * Uso: npx tsx scripts/create-admin-user.ts
 */
import dotenv from "dotenv";
import { hash } from "bcryptjs";
import readline from "node:readline";

dotenv.config({ path: ".env.local" });
dotenv.config();

const VALID_ROLES = ["owner", "admin", "operator"] as const;
type Role = (typeof VALID_ROLES)[number];

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const KEY_ENTER_LF = "\n";
const KEY_ENTER_CR = "\r";
const KEY_EOF = "\u0004"; // Ctrl+D
const KEY_INTERRUPT = "\u0003"; // Ctrl+C
const KEY_BACKSPACE_DEL = "\u007f";
const KEY_BACKSPACE_BS = "\b";

// Una sola interfaz readline para todo el script: crear una nueva por
// pregunta puede perder líneas ya buffereadas por la anterior cuando el
// input no llega tecla por tecla (pegado, o redirigido desde un archivo/pipe).
let sharedReadline: readline.Interface | null = null;
function getSharedReadline(): readline.Interface {
  if (!sharedReadline) {
    sharedReadline = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return sharedReadline;
}

function ask(question: string): Promise<string> {
  const rl = getSharedReadline();
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * Prompt de contraseña sin eco (no se imprime ni un asterisco): más simple y
 * robusto entre terminales que redibujar la línea con `*`, y evita cualquier
 * riesgo de dejar la contraseña visible en el historial de la terminal.
 * Si no hay TTY disponible (stdin no interactivo), cae a un prompt normal de
 * `readline` — no hay forma de ocultar eco fuera de una terminal real.
 */
function askHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return ask(question);
  }
  return new Promise((resolve) => {
    process.stdout.write(question);
    let value = "";
    stdin.resume();
    stdin.setRawMode?.(true);
    stdin.setEncoding("utf8");

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === KEY_ENTER_LF || char === KEY_ENTER_CR || char === KEY_EOF) {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === KEY_INTERRUPT) {
          process.stdout.write("\n");
          process.exit(130);
        }
        if (char === KEY_BACKSPACE_DEL || char === KEY_BACKSPACE_BS) {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function askRole(defaultRole: Role): Promise<Role> {
  const answer = (
    await ask(`Rol [owner/admin/operator] (Enter = ${defaultRole}): `)
  ).toLowerCase();
  if (!answer) return defaultRole;
  if ((VALID_ROLES as readonly string[]).includes(answer)) return answer as Role;
  console.error(`Rol inválido: "${answer}". Debe ser owner, admin u operator.`);
  return askRole(defaultRole);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("Falta DATABASE_URL en .env.local (conexión a Neon).");
    process.exit(1);
  }

  // Import diferido: recién acá se resuelve DATABASE_URL (ya validado arriba).
  const { getAdminUserByEmail, createAdminUser, updateAdminUser, listAdminUsers } = await import(
    "../lib/db/repositories/adminUsers"
  );

  const existingAdmins = await listAdminUsers();
  const isFirstAdmin = existingAdmins.length === 0;

  console.log(
    isFirstAdmin
      ? "No hay ningún admin todavía — vas a crear el primero."
      : `Ya existen ${existingAdmins.length} admin(es) en esta base.`
  );

  let email = "";
  while (!EMAIL_RE.test(email)) {
    email = (await ask("Email del admin: ")).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) console.error("Email inválido, intenta de nuevo.");
  }

  const existing = await getAdminUserByEmail(email);
  if (existing) {
    console.log(
      `Ya existe un admin con ese email (rol actual: ${existing.role}, activo: ${existing.active}).`
    );
    const confirm = await ask('Esto sobrescribirá su contraseña y rol. Escribe "SI" para confirmar: ');
    if (confirm.trim().toUpperCase() !== "SI") {
      console.log("Cancelado. No se modificó nada.");
      process.exit(0);
    }
  }

  let password = "";
  for (;;) {
    password = await askHidden("Contraseña: ");
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      continue;
    }
    const confirmPassword = await askHidden("Confirma la contraseña: ");
    if (confirmPassword !== password) {
      console.error("Las contraseñas no coinciden, intenta de nuevo.");
      continue;
    }
    break;
  }

  const role = await askRole(isFirstAdmin ? "owner" : "admin");

  const password_hash = await hash(password, 12);
  // La contraseña en texto plano ya no se necesita en memoria más allá de este punto.
  password = "";

  try {
    if (existing) {
      await updateAdminUser(existing.id, { password_hash, role, active: true });
    } else {
      await createAdminUser({ email, password_hash, role, active: true });
    }
  } catch (error) {
    console.error(
      "[create-admin-user] error guardando en la base:",
      error instanceof Error ? error.message : "error desconocido"
    );
    process.exit(1);
  }

  console.log(`Listo: ${email} (${role}) ${existing ? "actualizado" : "creado"} correctamente.`);
  process.exit(0);
}

void main();
