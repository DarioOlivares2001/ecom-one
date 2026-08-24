/**
 * Aplica la migración 0007 (drizzle/0007_add-storefront-theme.sql) contra el
 * Neon real de este proyecto. `drizzle-kit migrate` está desincronizado del
 * journal real de esta base (ya documentado en tareas anteriores), así que
 * las migraciones puramente aditivas se aplican a mano con este patrón
 * (mismo usado para 0005/0006), usando `ADD COLUMN IF NOT EXISTS` para que
 * sea seguro re-ejecutar sin duplicar ni fallar si ya se aplicó.
 *
 * No modifica ninguna fila existente de forma destructiva: la columna nueva
 * tiene DEFAULT 'conversion', así que la fila singleton actual de
 * store_settings (Vitanara) simplemente pasa a tener storefront_theme =
 * 'conversion' sin que se toque ningún otro campo.
 *
 * Uso: node -r dotenv/config scripts/apply-migration-0007-storefront-theme.mjs dotenv_config_path=.env.local
 */
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query(
    `ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "storefront_theme" text DEFAULT 'conversion' NOT NULL`
  );
  console.log("OK: columna storefront_theme presente en store_settings.");

  const { rows } = await client.query(
    `SELECT id, storefront_theme, theme_preset FROM store_settings`
  );
  console.log("Filas de store_settings tras la migración:", rows);
} finally {
  client.release();
  await pool.end();
}
