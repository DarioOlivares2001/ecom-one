import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL en .env.local");
}

// `@neondatabase/serverless` (driver HTTP) hace cada consulta con `fetch()`
// nativo — y Next.js parchea `fetch()` global para pasar por su Data Cache
// persistente (`.next/cache/fetch-cache`, sobrevive incluso entre builds).
// Sin `cache: "no-store"` acá, una consulta a Neon puede quedar cacheada por
// esa capa aunque la ruta que la llama sea `force-dynamic` — eso fue la
// causa raíz confirmada de que un producto recién activado no apareciera en
// `/productos`: la respuesta HTTP de Neon (no la página) estaba cacheada.
// Cada lectura a la base debe ser siempre en vivo; el cacheo de página
// (ISR, `revalidatePath`) es una decisión aparte, a nivel de ruta.
const sql = neon(databaseUrl, { fetchOptions: { cache: "no-store" } });

export const db = drizzle({ client: sql });
export { sql };