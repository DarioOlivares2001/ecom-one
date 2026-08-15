ALTER TABLE "products" ADD COLUMN "product_media" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
-- Backfill: antes de esta migración, `images` era a la vez la biblioteca de
-- medios y la galería pública (un solo concepto). Ahora se separan: cada
-- imagen que un producto ya tenía en `images` pasa también a `product_media`
-- (queda disponible como fuente para los bloques modulares), y `images` no
-- se toca — así ninguna ficha existente cambia. Solo aplica a productos con
-- `product_media` todavía vacío (valor por defecto de la columna recién
-- creada), para que sea seguro re-ejecutar sin duplicar ni pisar datos.
UPDATE "products"
SET "product_media" = "images"
WHERE "product_media" = '{}'::text[];