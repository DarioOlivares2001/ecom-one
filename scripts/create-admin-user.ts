/**
 * Crea (o actualiza, con confirmación explícita) un usuario admin en Neon.
 * Interactivo a propósito: pide email, contraseña (oculta) y rol por consola.
 * Nunca imprime la contraseña, su hash, ni DATABASE_URL.
 *
 * Uso: npm run admin:create
 */
import dotenv from "dotenv";
import { hash } from "bcryptjs";
import * as readline from "node:readline/promises";
import { Writable } from "node:stream";

dotenv.config({ path: ".env.local" });
dotenv.config();

const VALID_ROLES = ["owner", "admin", "operator"] as const;
type Role = (typeof VALID_ROLES)[number];

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type MainResult =
  | { action: "cancelled" }
  | { action: "created" | "updated"; email: string };

/**
 * Stream de salida que se puede "mutear" para pedir contraseñas sin eco.
 * Se usa como `output` de una única `readline.Interface` compartida para
 * todo el script — evitar crear más de una interfaz (o manipular
 * `process.stdin` en raw mode por fuera de ella) es lo que hace que el flujo
 * sea confiable: dos mecanismos compitiendo por el mismo stdin es lo que
 * causaba que el script terminara en silencio antes de terminar el INSERT.
 */
function createMaskableOutput() {
  let muted = false;
  const stream = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  return {
    stream,
    mute: () => {
      muted = true;
    },
    unmute: () => {
      muted = false;
    },
  };
}

const maskable = createMaskableOutput();
const rl = readline.createInterface({
  input: process.stdin,
  output: maskable.stream,
  terminal: process.stdin.isTTY,
});

async function ask(question: string): Promise<string> {
  maskable.unmute();
  const answer = await rl.question(question);
  return answer.trim();
}

/**
 * Igual que `ask`, pero lo que el usuario tipea no se hace eco en pantalla.
 * El prompt (`question`) sí se muestra: `rl.question` lo escribe de forma
 * síncrona antes de esperar input, y recién ahí muteamos el stream — el
 * truco estándar de Node para prompts de contraseña con `readline`.
 */
async function askHidden(question: string): Promise<string> {
  maskable.unmute();
  const pending = rl.question(question);
  maskable.mute();
  const answer = await pending;
  maskable.unmute();
  process.stdout.write("\n"); // el Enter del usuario no se mostró mientras estaba muteado.

  // Evita que la contraseña quede recuperable con la flecha ↑ en el historial de readline.
  const rlWithHistory = rl as unknown as { history?: string[] };
  if (Array.isArray(rlWithHistory.history)) {
    rlWithHistory.history = rlWithHistory.history.slice(1);
  }

  return answer.trim();
}

async function askRole(defaultRole: Role): Promise<Role> {
  for (;;) {
    const answer = (await ask(`Rol [owner/admin/operator] (Enter = ${defaultRole}): `)).toLowerCase();
    if (!answer) return defaultRole;
    if ((VALID_ROLES as readonly string[]).includes(answer)) return answer as Role;
    console.error(`Rol inválido: "${answer}". Debe ser owner, admin u operator.`);
  }
}

async function main(): Promise<MainResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Falta DATABASE_URL en .env.local (conexión a Neon).");
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
      return { action: "cancelled" };
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

  if (existing) {
    await updateAdminUser(existing.id, { password_hash, role, active: true });
  } else {
    await createAdminUser({ email, password_hash, role, active: true });
  }

  // Verificación de solo lectura contra Neon: confirma que el INSERT/UPDATE
  // realmente persistió (nunca se imprime el hash, solo se comprueba que existe).
  const verified = await getAdminUserByEmail(email);
  if (!verified || !verified.password_hash) {
    throw new Error(
      "El guardado no lanzó error, pero la verificación posterior no encontró el admin (o le falta el hash). Revisa la conexión a Neon."
    );
  }

  return { action: existing ? "updated" : "created", email };
}

main()
  .then((result) => {
    if (result.action === "cancelled") {
      console.log("Cancelado. No se modificó nada.");
    } else if (result.action === "created") {
      console.log(`Administrador creado correctamente: ${result.email}`);
    } else {
      console.log(`Administrador actualizado correctamente: ${result.email}`);
    }
    rl.close();
    process.exitCode = 0;
  })
  .catch((error: unknown) => {
    console.error(
      "[create-admin-user] Error:",
      error instanceof Error ? error.message : "error desconocido"
    );
    rl.close();
    process.exitCode = 1;
  });
