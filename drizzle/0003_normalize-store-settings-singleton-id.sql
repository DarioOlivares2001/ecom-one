-- Normaliza el id de la fila única de store_settings a un valor fijo y
-- conocido, para poder usar `INSERT ... ON CONFLICT (id) DO UPDATE/DO NOTHING`
-- de forma atómica (un solo round-trip) en vez del patrón previo
-- "select para ver si existe, luego insert o update" en dos pasos, que podía
-- correr en dos requests concurrentes y hacer que una de dos cosas gane la
-- carrera de forma impredecible (incluida la inicialización automática con
-- valores neutros pisando un guardado real del admin que llegó milisegundos
-- antes). uq_store_settings_singleton ya garantiza que nunca hay más de una
-- fila, así que este UPDATE es seguro y no borra ni duplica nada: solo
-- renombra el id de la fila que ya existe (si existe alguna).
UPDATE "store_settings"
SET "id" = '00000000-0000-0000-0000-000000000001'
WHERE "id" <> '00000000-0000-0000-0000-000000000001';
