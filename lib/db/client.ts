import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL en .env.local");
}

const sql = neon(databaseUrl);

export const db = drizzle({ client: sql });
export { sql };