# Migración ecom-one: Supabase → Neon + Drizzle + Cloudflare R2

Este documento se actualiza durante toda la migración. Última actualización: 2026-08-01.

## Fase actual

**Fase 3 — Capa de acceso a datos** (en curso).

## Resumen de fases

| Fase | Estado |
|---|---|
| 0. Protección del proyecto | ✅ Completada |
| 1. Auditoría de Supabase | ✅ Completada |
| 2. Esquema completo en Neon | ✅ Completada |
| 3. Capa de acceso a datos | 🔄 En curso |
| 4. Reemplazo de consultas por módulo | ⏳ Pendiente |
| 5. Autenticación y sesiones | ⏳ Pendiente |
| 6. Cloudflare R2 | ⏳ Pendiente |
| 7. Eliminación controlada de Supabase | ⏳ Pendiente |
| 8. Pruebas | ⏳ Pendiente |
| 9. Rendimiento y seguridad | ⏳ Pendiente |
| 10. Preparación de despliegue | ⏳ Pendiente |

---

## Fase 0 — Protección del proyecto

- Confirmado directorio de trabajo: `C:\tienda\ecom-one`.
- No existía repositorio git local → se ejecutó `git init` (sin remoto, sin tocar configuración global).
- `.gitignore` revisado: le faltaba ignorar `.env` (plano, sin sufijo `.local`) — agregado. Ya cubría `node_modules`, `.next`, `.vercel`, `.env*.local`.
- Identidad git global ya configurada (usuario existente) → se creó commit de checkpoint local `f0d2ccc` con el estado inicial del proyecto (sin `.env.local`, verificado explícitamente antes del commit).
- Nunca se mostró contenido de `.env.local`.

## Fase 1 — Auditoría de Supabase (resumen ejecutivo)

Auditoría completa realizada leyendo: 30 migraciones en `supabase/migrations/`, `lib/supabase/*`, `lib/db/*`, `drizzle/*`, `ARCHITECTURE.md`, `MULTI_TENANT_AUDIT.md`, y grep exhaustivo de todos los patrones Supabase en `app/**`, `lib/**`, `scripts/**`.

### Clientes Supabase usados

- `lib/supabase/admin.ts` — `createAdminClient()` (service_role). **Usado en ~90 archivos**, es el punto de entrada dominante.
- `lib/supabase/client.ts` — cliente browser (anon key). **Sin uso real** (confirmado por grep, 0 consumidores). Candidato a borrado directo.
- `lib/supabase/server.ts` — cliente server component (anon key + cookies). Único uso real: `app/api/reviews/route.ts` (inserción pública de reseñas vía RLS anónima).
- `lib/supabase/types.ts` — tipos manuales del esquema completo, usados como fuente de verdad para reconstruir columnas.

### Tablas — estado de migración a Drizzle

| Tabla | Estado | Notas |
|---|---|---|
| `products` | ✅ Ya migrada (`lib/db/schema.ts`, `drizzle/0000_create-products.sql`) | Coincide 1:1 con el esquema real acumulado (migraciones 001, 016, 018, 020, 029) |
| `product_variants` | ⏳ Pendiente | Reconstruida por introspección en migración 010_1 (sin `CREATE TABLE` original versionado) — tratar con precaución |
| `orders` | ⏳ Pendiente | CHECK de `status` evolucionó 3 veces (001→002→027); vigente: `awaiting_payment,pending,paid,preparing,shipped,delivered,cancelled` |
| `reviews` | ⏳ Pendiente | Moderación (`status`) agregada en 005 |
| `clientes` | ⏳ Pendiente | Tabla de cuentas de cliente **en uso real** (login, direcciones, recuperación de contraseña) |
| `customers` | ❌ No migrar | Huérfana: creada en 001, **0 consumidores en código** (confirmado por grep). Ver decisión abajo |
| `cliente_direcciones` | ⏳ Pendiente | FK a `clientes` con `ON DELETE CASCADE`; índice único parcial de dirección default |
| `admin_users` | ⏳ Pendiente | Roles `owner/admin/operator` (constraint agregado tardíamente en migración 030) |
| `store_settings` | ⏳ Pendiente | Fila única (índice singleton); incluye secreto `meta_capi_access_token` — RLS pública fue **eliminada** por seguridad en migración 028 |

### Decisión tomada: `customers` vs `clientes`

Evidencia de código (no solo nombre): `clientes` tiene `password_hash`, `rut_numero`/`rut_dv`, `reset_token`, y es consumida por ~15 archivos reales (login, registro, recuperación de contraseña, direcciones, checkout prefill, admin de clientes). `customers` (inglés) solo tiene campos de contacto agregados, sin login, y un grep dedicado (`from("customers")`) devuelve **0 resultados** en todo el código — ya estaba documentada como huérfana en `MULTI_TENANT_AUDIT.md`.

**Decisión: migrar solo `clientes` a Drizzle. No migrar `customers`** (no se elimina el hallazgo del historial, solo no se reconstruye en Neon — la base nueva parte vacía de todos modos, no hay datos que preservar).

### Función crítica: `confirm_paid_order_and_decrement_stock`

Única función RPC del proyecto (migración 017). Recorre `orders.items` (JSONB), descuenta stock de `products` o `product_variants` según corresponda con `SELECT ... FOR UPDATE` (bloqueo pesimista), es idempotente vía la columna `stock_discounted`, y solo transiciona `status: pending → paid` (no contempla `awaiting_payment → paid` explícitamente, aunque las órdenes reales se crean en `awaiting_payment` desde la migración 027 — posible comportamiento preexistente, no un bug introducido por esta migración).

**Decisión de arquitectura**: el driver actual (`drizzle-orm/neon-http` sobre `@neondatabase/serverless`) es HTTP *stateless* y no soporta transacciones interactivas multi-round-trip (`db.transaction` con lógica JS intermedia). Para no debilitar la atomicidad, esta función se portará **tal cual como función nativa PL/pgSQL en Neon** (idéntica a la de producción, solo quitando el `GRANT ... TO service_role` que es específico de Supabase) y se invocará desde Drizzle vía `db.execute(sql\`select * from confirm_paid_order_and_decrement_stock(${orderId})\`)`. Esto preserva el lock de fila, la idempotencia y el rollback automático ante error (si la función lanza excepción, Postgres revierte todo el bloque). **No se modifica la lógica de negocio** (se preserva el comportamiento exacto frente a `pending`/`awaiting_payment`, incluida la particularidad documentada arriba).

### Buckets de Storage → Cloudflare R2

| Bucket Supabase | Contenido | Prefijos |
|---|---|---|
| `products` | Imágenes de productos | Sin prefijo fijo documentado |
| `store-assets` | Logo, hero banners, favicon/iconos PWA | `logos/`, `hero-banners/`, `favicons/` |
| `branding` | Huérfano, sin consumidores en código | No migrar |

### Hallazgo de seguridad: fallback de `SUPABASE_SERVICE_ROLE_KEY` en sesiones

`lib/admin/session.ts` y `lib/cuenta/session.ts` usan `SUPABASE_SERVICE_ROLE_KEY` como **fallback** del secreto HMAC si `ADMIN_SESSION_SECRET`/`CUENTA_SESSION_SECRET` no están definidas. Se eliminará este fallback en Fase 5 — requiere que ambas variables estén configuradas explícitamente antes de retirar Supabase, o el login (admin y cliente) dejará de funcionar en runtime.

### RLS

No se usa como barrera real: el ~100% del tráfico pasa por `service_role` (bypassa RLS). No se migran policies a Neon; la única protección funcionalmente relevante (inserción pública de reseñas) se recreará como validación de aplicación (ya es server-side vía Zod).

### Dependencias npm a retirar en Fase 7

`@supabase/ssr@^0.1.0`, `@supabase/supabase-js@^2.104.1` (solo cuando `rg` confirme 0 consumidores).

---

## Migraciones Drizzle

| Migración | Contenido | Aplicada | Verificada |
|---|---|---|---|
| `0000_create-products.sql` | Tabla `products` completa + trigger `set_updated_at` | ✅ (previamente, fuera de esta sesión) | — |
| `0001_add_core_ecommerce_tables.sql` | Tablas `product_variants`, `orders`, `reviews`, `clientes`, `cliente_direcciones`, `admin_users`, `store_settings` + todos los CHECK/índices funcionales-parciales/triggers `set_updated_at` + función `confirm_paid_order_and_decrement_stock` | ✅ | ✅ (ver abajo) |

### Verificación de la migración 0001 (consultas de solo lectura + prueba transaccional con rollback)

- `to_regclass` confirma las 8 tablas creadas.
- `information_schema.columns`: conteo de columnas coincide exactamente con lo diseñado (products 25, product_variants 14, orders 20, reviews 13, clientes 18, cliente_direcciones 11, admin_users 8, store_settings 51).
- `pg_constraint` (CHECK): 23 constraints creados y verificados (products 8 ya existentes + product_variants 6 + orders 4 + reviews 2 + clientes 2 + admin_users 1).
- `pg_indexes`: todos los índices simples, funcionales (`clientes_email_lower_idx`, `admin_users_email_idx`) y parciales (`orders_display_code_idx`, `idx_clientes_reset_token`, `clientes_rut_numero_dv_key`, `cliente_direcciones_default_unique`, `uq_store_settings_singleton`) presentes.
- `information_schema.triggers`: 8 triggers `trg_*_updated_at` (uno por tabla) apuntando a `set_updated_at()`.
- `pg_proc`: función `confirm_paid_order_and_decrement_stock(uuid)` presente.
- `pg_constraint` (FK): 4 foreign keys correctas (`product_variants→products`, `reviews→products` ON DELETE CASCADE, `reviews→orders`, `cliente_direcciones→clientes` ON DELETE CASCADE).
- **Prueba funcional de la función crítica** (`scripts/verify-migration-0001.mjs`, usa `Pool`/WebSocket para una transacción real con `BEGIN`/`ROLLBACK`, datos con slug `__migration_test__` / email `test@example.com` claramente identificables como temporales): creó 1 producto (stock=5) y 1 orden `pending` con 1 item (qty=2) dentro de una transacción; 1ra llamada a `confirm_paid_order_and_decrement_stock` → `already_discounted=false`, `decremented_lines=1`, `final_status='paid'`; 2da llamada (misma orden) → `already_discounted=true`, `decremented_lines=0` (idempotencia confirmada); stock final del producto = 3 (5-2, correcto); `ROLLBACK` ejecutado; se confirmó con una consulta posterior que 0 filas de prueba quedaron en la base.

### Decisiones de diseño tomadas en la Fase 2

1. **`customers` no se migra** — huérfana, 0 consumidores reales (ver Fase 1). Solo se migró `clientes`.
2. **`confirm_paid_order_and_decrement_stock` se portó como función PL/pgSQL nativa** (idéntica a producción, sin `GRANT ... TO service_role` que es específico de Supabase/no existe en Neon), invocada vía `db.execute(sql\`select * from confirm_paid_order_and_decrement_stock(...)\`)`. Motivo: el driver `drizzle-orm/neon-http` es HTTP stateless y no soporta transacciones interactivas multi-round-trip; mantener la función nativa preserva el lock pesimista (`FOR UPDATE`), la idempotencia y el rollback automático sin depender del driver. **No se modificó la lógica de negocio** (se preservó intacta la particularidad ya documentada: la función solo transiciona `pending→paid`, no `awaiting_payment→paid` explícitamente).
3. **Triggers `updated_at` agregados también en `clientes` y `reviews`**, donde el proyecto de origen no los tenía. En ambos casos la propia migración de origen documentaba esto como una omisión histórica accidental (para "no cambiar el comportamiento de producción de otro proyecto"), no como una regla de negocio — no aplica a una tienda nueva que parte vacía. Es una mejora de higiene de datos sin efecto en comportamiento comercial.
4. **No se aplicó la parte B ("paridad dev=prod") de la migración opcional 030** del proyecto de origen (que quitaba defaults de 8 columnas de color de `store_settings` y cambiaba nullability en 3 columnas para replicar deriva histórica de *otra* base de producción). Para una tienda nueva e independiente esa réplica no aporta nada; se mantuvieron columnas `NOT NULL` con defaults sensatos. Sí se incorporó la parte A (hardening: constraints/índices/triggers) directamente en el diseño base. Ningún dato ni regla comercial se ve afectado por esta decisión — son solo defaults de configuración visual que el admin sobrescribe al guardar.
5. **Esquema modularizado** en `lib/db/schema/{products,productVariants,orders,reviews,clientes,clienteDirecciones,adminUsers,storeSettings}.ts` con barrel `index.ts`; `drizzle.config.ts` actualizado a `./lib/db/schema/index.ts`. El antiguo `lib/db/schema.ts` monolítico fue reemplazado (su único contenido, `products`, se movió sin cambios a `products.ts`).
6. **Convención de migración**: igual que `0000_create-products.sql`, Drizzle genera columnas/FKs/índices simples; los CHECK, índices funcionales/parciales y triggers se agregan a mano en el mismo archivo de migración (Drizzle no los representa completamente).

## Pendientes inmediatos (Fase 3)

- Crear `lib/db/repositories/*` (productos, variantes, pedidos, clientes, direcciones, reseñas, admin_users, store_settings) y `lib/db/transactions/confirmPaidOrder.ts` (wrapper tipado sobre la función nativa).
- Diseñar tipos inferidos (`$inferSelect`/`$inferInsert`) para reemplazar `lib/supabase/types.ts`.

## Bloqueos externos

Ninguno por ahora. Credenciales de Cloudflare R2 aún no confirmadas — se documentarán en `R2_SETUP.md` cuando se llegue a la Fase 6 si no están presentes en `.env.local`.
