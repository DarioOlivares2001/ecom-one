import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const result = await sql`
  SELECT to_regclass('public.products') AS products_table;
`;

console.table(result);