# Migración ecom-one: Supabase → Neon + Drizzle + Cloudflare R2

Este documento se actualiza durante toda la migración. Última actualización: 2026-08-03.

## Fase actual

**Migración completa (Fases 0–10) + Fase 11 (correcciones instalación vacía) + Fase 12 (fix de persistencia de `store_settings`).** Ver checklist de despliegue más abajo antes de lanzar a producción.

## Resumen de fases

| Fase | Estado |
|---|---|
| 0. Protección del proyecto | ✅ Completada |
| 1. Auditoría de Supabase | ✅ Completada |
| 2. Esquema completo en Neon | ✅ Completada |
| 3. Capa de acceso a datos | ✅ Completada |
| 4. Reemplazo de consultas por módulo | ✅ Completada (salvo Storage, ver nota) |
| 5. Autenticación y sesiones | ✅ Completada |
| 6. Cloudflare R2 | ✅ Completada (credenciales configuradas y verificadas) |
| 7. Eliminación controlada de Supabase | ✅ Completada |
| 8. Pruebas | ✅ Completada |
| 9. Rendimiento y seguridad | ✅ Completada |
| 10. Preparación de despliegue | ✅ Completada |
| 11. Correcciones instalación nueva/vacía (mocks, imágenes, carrito, admin, store_settings) | ✅ Completada |
| 12. Fix de persistencia singleton en `store_settings` | ✅ Completada |

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

## Fase 3 — Capa de acceso a datos (completada)

**Decisión de arquitectura clave**: los repositorios devuelven objetos en **snake_case** (mismo shape que `lib/supabase/types.ts`), no el shape camelCase nativo de Drizzle. Se creó `lib/db/types.ts` con esas interfaces (copia desacoplada de `Database`, sin el wrapper de Supabase). Cada repositorio tiene una función `mapX(row)` que convierte el resultado camelCase de Drizzle al shape snake_case. Motivo: decenas de archivos ya acceden a campos como `row.store_name`, `order.customer_email`, `product.compare_at_price` — con este mapeo, la Fase 4 solo necesita cambiar *cómo se obtienen* los datos (llamar a un repositorio en vez de `supabase.from(...)`), no *cómo se leen* sus campos en cada pantalla/acción. Reduce drásticamente el riesgo de la reescritura de ~90 archivos.

Archivos creados:
- `lib/db/types.ts` — interfaces Row en snake_case (products, product_variants, orders, reviews, clientes, cliente_direcciones, admin_users, store_settings + Json/ShippingAddress/OrderItem).
- `lib/db/repositories/{products,productVariants,orders,reviews,clientes,clienteDirecciones,adminUsers,storeSettings}.ts` + `index.ts` — funciones tipadas de lectura/escritura por dominio (get/list/create/update, sin lógica HTTP ni Zod, eso queda en la capa de rutas/actions en Fase 4).
- `lib/db/transactions/confirmPaidOrder.ts` — wrapper tipado sobre la función nativa `confirm_paid_order_and_decrement_stock`.

`npx tsc --noEmit` sobre todo el proyecto: **0 errores** (la capa de datos nueva compila limpia; el resto del código, sin tocar todavía, sigue compilando contra Supabase sin conflictos).

## Fase 4 — Reemplazo de consultas por módulo (en curso)

Orden de trabajo (según catálogo de módulos de la mission): catálogo público → detalle de producto → variantes/descuentos → recomendaciones/upsells → reseñas → configuración de tienda → admin productos → admin pedidos → admin clientes → admin usuarios → cuenta de cliente → direcciones → checkout → Flow create → Flow webhook → cron pedidos vencidos → confirmación de pago/stock → tracking Meta/CAPI → scripts administrativos.

Los helpers de `lib/supabase/*` NO se eliminan todavía — se retiran recién en la Fase 7, cuando `rg` confirme 0 consumidores restantes.

### Fase 4 — Cierre

Todos los módulos de datos (no-storage) migrados a Drizzle: catálogo, producto, variantes, reseñas (público + admin), recomendaciones/upsells, landing, admin de productos (CRUD completo), checkout, Flow (create/webhook), confirmación de pago/stock, seguimiento público, cron de pedidos vencidos, admin de pedidos + dashboard, store_settings (config general + Meta + Clarity), admin de usuarios, admin de clientes, cuenta de cliente completa (login/registro/recuperación/reset/datos/direcciones/checkout-prefill/checkout-save-shipping), y `scripts/create-admin-user.ts`.

Verificado con `rg`: `lib/supabase/server.ts` y `lib/supabase/client.ts` ya no tienen **ningún** consumidor. `createAdminClient()` solo sigue usándose para **Storage** (subida de imágenes) en 4 archivos — deliberadamente diferido a la Fase 6 (R2), ya que migrar esas llamadas antes de tener R2 funcionando dejaría el admin sin poder subir imágenes:
- `app/admin/productos/nuevo/actions.ts` (imágenes de producto — la parte de BD de este archivo ya está en Drizzle)
- `app/api/upload/logo/route.ts`, `app/api/upload/favicon/route.ts`, `app/api/upload/hero/route.ts`

Scripts de imágenes (`scripts/{list,optimize,cleanup-original,fix}-product-image*.mjs`) también quedan pendientes de Fase 6 por la misma razón (leen/escriben Storage).

**tsc --noEmit: 0 errores** en todos los checkpoints de esta fase.

## Fase 5 — Autenticación y sesiones propias (completada)

- Eliminado el fallback a `SUPABASE_SERVICE_ROLE_KEY` en `lib/admin/session.ts` y `lib/cuenta/session.ts`. Ambas funciones (`getAdminSessionSecret`/`getSessionSecret`) ahora exigen exclusivamente `ADMIN_SESSION_SECRET`/`CUENTA_SESSION_SECRET` y lanzan error explícito si faltan.
- `.env.local` no tenía ninguna de las dos variables (ni `SUPABASE_SERVICE_ROLE_KEY`, es decir el login ya estaba roto antes de este cambio) → se generaron con `crypto.randomBytes(32).toString('hex')` y se agregaron directamente al archivo **sin mostrarlas nunca en la terminal ni en este documento**. Mismo tratamiento para `CRON_SECRET` (protege `/api/cron/cancel-stale-orders`, tampoco existía).
- `.env.example` actualizado: nueva sección de secretos de sesión (con el comando para regenerarlos) y `CRON_SECRET`. Las variables de Supabase se mantienen ahí por ahora — se retiran en la Fase 7.
- Revisión de seguridad de sesiones (checklist de la misión), todo correcto y sin cambios necesarios más allá del fallback:
  - `httpOnly: true` en ambas cookies.
  - `secure: process.env.NODE_ENV === "production"`.
  - `sameSite: "lax"`.
  - Expiración: admin 12h, cuenta 30 días, token de reset de contraseña 1h.
  - Comparación de firma HMAC con `timingSafeEqual` (ambas sesiones).
  - Hash de contraseña con `bcryptjs` (cost 12) en todos los flujos (admin, cliente, reset).
  - Recuperación de contraseña: token `randomUUID()` de un solo uso con expiración; `POST /api/cuenta/recuperar` siempre responde `{ok:true}` exista o no la cuenta (previene enumeración de emails) — comportamiento preexistente, no tocado.
  - Protección de rutas admin: `app/admin/layout.tsx` verifica `getAdminSessionFromCookies()` y redirige a `/admin/login` — preexistente, verificado intacto tras la migración.
- `rg SUPABASE_SERVICE_ROLE_KEY` confirma cero usos restantes como fallback de secretos; las únicas referencias que quedan son `.env.example` (pendiente Fase 7), los tres archivos `lib/supabase/*.ts` (pendiente Fase 7) y los scripts de imágenes (pendiente Fase 6).

**tsc --noEmit: 0 errores.**

## Fase 6 — Cloudflare R2 (código completo, bloqueada en credenciales)

Implementado y compilando (`tsc --noEmit`: 0 errores):

- `lib/storage/r2.ts` — módulo aislado con `uploadToR2`, `deleteFromR2`, `extractR2KeyFromPublicUrl`, `isR2Configured`, validación de MIME permitidos y límite de tamaño (10 MB). Usa `@aws-sdk/client-s3` (instalado) contra el endpoint S3-compatible de R2 (`https://<account_id>.r2.cloudflarestorage.com`). Variables privadas sin prefijo `NEXT_PUBLIC_*`.
- Migrados a R2: `app/api/upload/{logo,favicon,hero}/route.ts` y las subidas de imágenes de producto en `app/admin/productos/nuevo/actions.ts` (la parte de BD de ese archivo ya estaba en Drizzle desde la Fase 4). Cada ruta valida `isR2Configured()` primero y devuelve un error 503 controlado (no 500 ni crash) si faltan credenciales.
- Migrados a R2 + Neon: los 4 scripts de imágenes (`scripts/{list,optimize,cleanup-original,fix}-product-image*.mjs`) — antes usaban `@supabase/supabase-js` tanto para la tabla `products`/`product_variants` como para Storage; ahora usan el driver `neon()` para SQL y `@aws-sdk/client-s3` para Storage directamente. Son scripts standalone `.mjs` que no pueden importar `lib/storage/r2.ts` (TypeScript) sin un paso de build, así que el cliente S3 se declara inline en cada uno — mismo patrón que ya tenían con Supabase (cada script creaba su propio cliente, sin helper compartido).
- `next.config.mjs`: agrega el dominio de `R2_PUBLIC_URL` a `images.remotePatterns` dinámicamente (parseado en build time; no rompe si la variable no está seteada). El patrón `*.supabase.co` se deja como comentario "legacy" para imágenes ya subidas antes de esta migración (no aplica a esta tienda nueva, pero no hace daño dejarlo).
- `.env.example` actualizado con las 5 variables `R2_*` documentadas.
- Estructura de carpetas en el bucket: `logos/`, `favicons/`, `hero-banners/`, `products/`.

**Credenciales configuradas y verificadas** (2026-08-02): el usuario agregó las 5 variables `R2_*` en `.env.local`. Verificación realizada con un script Node temporal (creado, ejecutado y **borrado** en la misma sesión, nunca commiteado): subida de un objeto de prueba (`__verify_r2_test__/<uuid>.txt`) al bucket real, `HeadObject` (tamaño coincide), `GetObject` (contenido byte-a-byte idéntico), `DeleteObject`, y una segunda `HeadObject` que confirma `404 NotFound` tras el borrado (limpieza real, no quedó nada de prueba en el bucket). Ningún valor de `.env.local` ni URL con secretos se mostró en ningún momento — solo `ok`/`missing` por variable. **Fase 6 completada.**

## Fase 7 — Retiro controlado de Supabase (completada)

- Confirmado por `rg`/grep: cero consumidores reales de `@supabase/supabase-js`, `@supabase/ssr`, `createAdminClient`, `createServerClient`/`createBrowserClient` y de los tres módulos `lib/supabase/{admin,server,client}.ts` en todo `app/**`, `lib/**`, `scripts/**`.
- `lib/supabase/types.ts` (tipos manuales `Json`/`Database`, sin dependencia real de Supabase) tenía 13 consumidores que solo usaban los tipos `Json`, `Product`, `ProductVariant` y `Review` — ya existían equivalentes en `lib/db/types.ts` (creado en la Fase 3). Se redirigieron los 13 imports a `@/lib/db/types` (incluido un caso que usaba `Database["public"]["Tables"]["product_variants"]["Row"]`, reemplazado por el tipo `ProductVariant` directo).
- Eliminado el directorio `lib/supabase/` completo (`admin.ts`, `server.ts`, `client.ts`, `types.ts`).
- `npm uninstall @supabase/ssr @supabase/supabase-js` — 13 paquetes removidos de `package.json`/`package-lock.json`.
- `.env.example`: reemplazada la sección "Supabase" (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) por `DATABASE_URL` (Neon), que no estaba documentada.
- `next.config.mjs`: eliminado el `remotePattern` legacy de `*.supabase.co` — la tienda es nueva y parte vacía, no hay imágenes antiguas que preservar.
- Se mantiene sin tocar (fuera de alcance de Supabase): `supabase/migrations/*.sql` como registro histórico del esquema de origen (sin dependencia de runtime, sin secretos), y las menciones a Supabase en `ARCHITECTURE.md`/`MULTI_TENANT_AUDIT.md`/`MIGRATION_STATUS.md`/`R2_SETUP.md` (documentación narrativa de la migración) y en comentarios de procedencia dentro de `drizzle/0001_add_core_ecommerce_tables.sql` (documentan de qué migración original viene cada bloque).
- **Hallazgo menor, no corregido** (fuera de alcance — no es código de runtime): `tmp-product-images-audit.csv` (tracked en git desde antes de esta sesión) contiene URLs públicas `https://<ref>.supabase.co/storage/...` de un audit previo. No son secretos (URLs de bucket público), pero es un artefacto obsoleto — se deja para que el usuario decida si lo borra.
- `npx tsc --noEmit`: **0 errores** tras todos los cambios.

### Nota de seguridad detectada (no introducida por esta fase)

`npm uninstall` reportó **13 vulnerabilities (4 moderate, 9 high)** preexistentes en dependencias transitivas (no relacionadas a Supabase ni introducidas por su retiro). Se revisan en la Fase 9.

## Fase 8 — Pruebas (completada)

- **`npx tsc --noEmit`**: 0 errores en todo el proyecto.
- **`npm run build`** (`next build`, incluye lint + type-check + generación de 63 páginas): falló inicialmente por 2 errores `@typescript-eslint/no-explicit-any` preexistentes en `app/admin/productos/[id]/page.tsx` (introducidos en la migración de Fase 4, commit `2f3cbc8`) — el comentario `eslint-disable-next-line` original solo cubría la línea siguiente (la apertura de `<EditProductoForm`), no las dos líneas con los casts `as any`. Corregido reemplazando por un bloque `eslint-disable`/`eslint-enable` que cubre ambos casts (mismo `any` ya justificado en el comentario existente: `variants`/`options` son JSON dinámico). Tras el fix: **build exitoso**, 63 rutas generadas, y los logs de build confirman conexión real a Neon durante la generación estática (`store_settings` leído en build time para el hero de home).
- **Smoke test de conectividad Neon** (`scripts/test-neon.mjs` vía `node --env-file=.env.local`): `to_regclass('public.products')` devuelve `products` — conexión y esquema confirmados.
- **Smoke test de la app corriendo** (`npm run dev`, probado y detenido dentro de la sesión — sin exponerlo ni dejarlo corriendo): `/` (200, título correcto), `/productos` (200), `/carrito` (200), `/checkout` (200), `/seguimiento` (200), `/admin/login` (200), `/api/upsells` (405 en GET — endpoint es POST-only, comportamiento esperado, no un bug).
- No existe script `test` en `package.json` (no hay suite de tests unitarios/integración en el proyecto); la verificación se basó en type-check, build, smoke tests de DB y de rutas HTTP reales.

## Fase 9 — Seguridad y rendimiento (completada)

### Hallazgo crítico corregido: rutas de upload y varias Server Actions de admin sin verificación de sesión

`middleware.ts` solo protege `/admin/:path*` (páginas), no `/api/upload/*` ni las Server Actions. A diferencia de `/api/admin/*` (que sí valida `getAdminSessionFromCookies()` en cada handler), se encontraron **9 endpoints/acciones mutables sin ninguna verificación de sesión**, explotables por cualquier visitante anónimo de internet:

- `app/api/upload/logo/route.ts`, `app/api/upload/favicon/route.ts`, `app/api/upload/hero/route.ts` — permitían subir archivos arbitrarios (dentro de los límites de MIME/tamaño) al bucket público de R2 sin autenticación, con riesgo de reemplazar el logo/favicon/banners de la tienda (defacement) o abusar del storage/egress.
- `app/admin/productos/nuevo/actions.ts` (`createProductAction`, `updateProductAction`, `archiveProductAction`, `restoreProductAction`) — Server Actions invocables directamente por su ID de acción, sin depender de que el layout bloquee la carga de la página.
- `app/admin/pedidos/actions.ts` (`updateOrderStatusAction`) — permitía forzar el estado de cualquier pedido, incluido marcarlo `paid` (dispara el descuento de stock).
- `app/admin/marketing/meta/page.tsx` (`saveMetaSettingsAction`) — el más grave: permitía sobrescribir `meta_capi_access_token` (secreto de Meta CAPI) sin autenticación.
- `app/admin/marketing/clarity/page.tsx` (`saveClaritySettingsAction`) y `app/admin/configuracion/page.tsx` (`saveSettingsAction`) — permitían modificar configuración pública de la tienda (colores, textos, banners) sin autenticación.
- `app/admin/resenas/page.tsx` (`approveReviewAction`, `rejectReviewAction`, `hideApprovedReviewAction`) — permitían aprobar/rechazar/ocultar reseñas sin autenticación.

**No introducido por esta migración**: confirmado en el histórico de git que la falta de verificación en las rutas de upload ya existía en el checkpoint inicial (`f0d2ccc`), antes de tocar Supabase/R2/Drizzle — es un bug preexistente del proyecto original.

**Corrección aplicada** (mismo patrón ya usado en `/api/admin/*`: `getAdminSessionFromCookies()` de `lib/admin/session.ts`, sin restricción de rol adicional, igual que el resto de páginas del árbol `/admin`): se agregó el chequeo al inicio de las 3 rutas API (`401` si no hay sesión) y de las 9 Server Actions (`{ error: "No autorizado." }` si no hay sesión, mismo shape de retorno que ya usan). Verificado con `rg`/lectura manual que estos eran los únicos 6 archivos `"use server"` bajo `app/admin/**` y que `/api/cuenta/*` (sesión de cliente) ya validaba sesión correctamente en los 7 endpoints mutables (revisado en Fase 5, sin cambios necesarios).

**Verificación funcional**: con el servidor corriendo localmente (`npm run dev`, iniciado y detenido dentro de la sesión), `curl -X POST` sin cookies a `/api/upload/logo`, `/api/upload/favicon` y `/api/upload/hero` devuelve `401` (antes subían el archivo). `npx tsc --noEmit` y `npm run build` sin errores tras el cambio.

### Dependencias — `npm audit`

- Al retirar `@supabase/*` en Fase 7, `npm uninstall` reveló **13 vulnerabilidades** preexistentes (no relacionadas a Supabase).
- `npm audit fix` (sin `--force`) resolvió las que no requerían cambio de versión mayor (incluida `js-cookie` vía `resend → @react-email/render → js-beautify`, una dependencia transitiva de bajo riesgo real ya que no se usa `js-cookie` directamente en este código — las cookies de sesión propias se manejan a mano). Quedaron **10 vulnerabilidades** que solo se resuelven con `--force` (cambio de versión mayor):
  - **`next` 14.2.35 → 16.2.12** (mayor): varias CVEs de DoS/SSRF/XSS en Next.js. **No se aplicó** — es un salto de versión mayor (14→16) con riesgo real de romper la app (App Router, Server Actions, config); requiere que el usuario decida y se pruebe aparte, fuera del alcance de esta sesión autónoma.
  - **`sharp` 0.34.5 → 0.35.3** (mayor en semver 0.x): CVEs de libvips heredadas. Usado solo para comprimir imágenes ya subidas por un admin autenticado (tras el fix de arriba) — superficie de ataque baja, pero **no se aplicó** por ser cambio de versión mayor; recomendado evaluarlo en una sesión de mantenimiento aparte.
  - El resto son dependencias de build/dev (`eslint-config-next`, `drizzle-kit`/`@esbuild-kit/*`, `postcss` interno de `next`, `glob` CLI) — no se ejecutan en producción con input de usuarios finales.

### Rendimiento

- `npm run build`: 63 rutas generadas sin advertencias de tamaño; ninguna ruta admin ni pública destaca por bundle excesivo.
- Revisado `app/admin/dashboard/page.tsx` (el más pesado, 105 kB): `getDashboardMetrics` trae todo en consultas batched; el `for` sobre `chartRows` es agregación en memoria (no hay N+1 de queries).
- Índices, constraints y triggers ya cubiertos en el diseño de esquema (Fase 2); no se detectaron patrones de N+1 adicionales en listados admin revisados.
- Imágenes: ya comprimidas a WebP en servidor antes de subir a R2 (logo/favicon/hero/producto), con caché `immutable` de 1 año — sin cambios necesarios.

### Hallazgo menor no corregido (bajo impacto, documentado para el usuario)

`app/api/admin/login/route.ts` y `app/api/cuenta/login/route.ts`: cuando el email no existe, se retorna sin llamar a `bcrypt.compare`, creando una diferencia de tiempo de respuesta teórica frente a "contraseña incorrecta" (email enumeration por timing). En `cuenta/login` esto es irrelevante en la práctica porque el mensaje de error **ya** distingue explícitamente "cuenta no registrada" de "contraseña incorrecta" (decisión de producto ya tomada, no de esta sesión). En `admin/login` el mensaje sí es genérico, así que ahí el timing es el único vector residual — de explotación poco práctica sobre HTTP real (jitter de red), y limitada a la lista pequeña de emails admin. Se documenta pero no se corrigió (fuera del alcance priorizado de esta sesión).

## Fase 10 — Documentación final y checklist de despliegue (completada)

- `ARCHITECTURE.md` reescrito para reflejar el stack actual (Neon + Drizzle + R2 + sesiones propias): stack tecnológico, variables de entorno, capa de acceso a datos, esquema de las 8 tablas reales, función nativa de stock, sección nueva **Autenticación y sesiones** (no existía), flujo de pago actualizado (webhook re-verifica contra Flow en vez de confiar en el body), y convenciones actualizadas (capa de repositorios, verificación de sesión en rutas/actions admin). El documento anterior describía la arquitectura pre-migración (Supabase, RLS, tablas viejas) y ya no era confiable.
- `MIGRATION_STATUS.md` (este documento) queda como registro histórico completo de las 10 fases, decisiones de diseño y verificaciones.
- `R2_SETUP.md` se mantiene como referencia de configuración de R2 (ya ejecutada).

### Checklist de despliegue a producción

No ejecutado en esta sesión (sin deploy, sin git push, según instrucción). Antes de desplegar a Vercel (u otro hosting):

**Variables de entorno (todas las de `.env.example`, configurarlas en el dashboard del hosting — nunca commitear `.env.local`):**
- [ ] `DATABASE_URL` — apuntando a la base de Neon de **producción** (si se usó una base distinta a la de desarrollo, aplicar las migraciones de `drizzle/*.sql` ahí también).
- [ ] `ADMIN_SESSION_SECRET`, `CUENTA_SESSION_SECRET`, `CRON_SECRET` — generar valores **nuevos y distintos** a los de desarrollo (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`); no reusar los de `.env.local`.
- [ ] `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` — si `R2_PUBLIC_URL` usa el subdominio `*.r2.dev` (desarrollo), migrar a un dominio propio (ver `R2_SETUP.md`, opción A) antes de lanzar — `R2_SETUP.md` ya advertía no usar `r2.dev` como solución definitiva.
- [ ] `FLOW_API_KEY`, `FLOW_SECRET_KEY`, `FLOW_API_URL` — credenciales **reales** de Flow (no sandbox), y confirmar que `FLOW_MOCK` no esté seteado a `true` ni la API key contenga la palabra "sandbox".
- [ ] `NEXT_PUBLIC_SITE_URL` — dominio canónico de producción (HTTPS, sin barra final).
- [ ] `RESEND_API_KEY`, `STORE_CONTACT_EMAIL`, `STORE_FROM_EMAIL` — cuenta de Resend en modo producción (dominio verificado, no sandbox).
- [ ] `NEXT_PUBLIC_META_PIXEL_ID` — si se usa tracking de Meta.

**Antes del primer deploy:**
- [ ] Crear el primer usuario admin en la base de producción con `npm run admin:create` (interactivo — pide email/contraseña por consola, ver Fase 11) — no hay usuarios admin por defecto.
- [ ] Configurar el cron de Vercel (o equivalente) para `POST /api/cron/cancel-stale-orders` con el header/`Authorization` que espera la ruta usando `CRON_SECRET`.
- [ ] Confirmar `next.config.mjs` → `images.remotePatterns` resuelve bien `R2_PUBLIC_URL` de producción (se parsea en build time; falla silenciosamente a `null` si la URL es inválida, no rompe el build).

**Después del deploy (smoke test manual, con datos de prueba):**
- [ ] Login admin, crear un producto con imagen (confirma R2 en producción), aprobar/rechazar una reseña.
- [ ] Flujo de checkout completo con Flow en modo real (una transacción de prueba pequeña) hasta `/checkout/confirmacion`, y confirmar que el webhook descuenta stock y envía el email de notificación.
- [ ] Login de cuenta de cliente (registro, recuperación de contraseña).
- [ ] Revisar logs del primer despliegue por errores de conexión a Neon (cold start) o R2.

**Pendiente, no bloqueante para lanzar (decisión del usuario, no ejecutado en esta sesión):**
- [ ] Evaluar upgrade mayor de `next` (14.2.35 → 16.x) y `sharp` (0.34 → 0.35) para cerrar las vulnerabilidades de `npm audit` que requieren `--force` (ver Fase 9) — requiere pruebas de regresión propias, no se hizo en esta sesión por el riesgo de romper la app.
- [ ] `tmp-product-images-audit.csv` (tracked en git, contiene URLs públicas antiguas de `*.supabase.co` de un audit previo) — artefacto obsoleto, sin secretos, se dejó para que el usuario decida si lo borra.
- [ ] Rate limiting en `/api/admin/login` y `/api/cuenta/login` (no existe hoy; requiere decidir infraestructura — Redis/Upstash u otro — no viable como cambio local sin esa pieza de infra).

## Fase 11 — Correcciones tras prueba local con Neon vacío (completada)

Se probó la app localmente contra una base Neon **genuinamente vacía** y aparecieron 5 fallos, todos corregidos en esta sesión. Commit local: `fix: initialize empty store and harden cart`.

### 1. Eliminados los fallbacks a productos mock

- Borrado `lib/utils/mock-products.ts` (8 productos ficticios + `getMockProduct`).
- `app/(store)/productos/page.tsx`: `getProducts()` ya no cae a `MOCK_PRODUCTS` si la query da 0 filas o falla — devuelve `[]` (la UI ya tenía un estado vacío propio con ícono y "No hay productos disponibles", solo faltaba dejar de ocultarlo).
- `app/(store)/productos/[slug]/page.tsx`: `getProduct()` ya no cae a `getMockProduct(slug)` (antes devolvía `MOCK_PRODUCTS[0]` para **cualquier** slug inexistente, incluso ajeno a un mock — un 404 real se disfrazaba de producto ficticio). `getUpsellCandidates()` ya no cae a productos mock filtrados.
- `lib/store/landing-home-catalog.ts`: borrado `LANDING_FALLBACK_INDIVIDUAL_PRODUCTS` (4 "packs" ficticios que aparecían en el home cuando el catálogo estaba vacío); `resolveLandingBentoSections()` ahora deja el grid vacío (ya soportado por `BentoGrid`, que retorna `null` si `items.length === 0`).
- Confirmado con `rg` (sin uso de mocks en ningún flujo real) y con logs de servidor en vivo: `[perf-products] products count: 0` con la base vacía real, no ficticia.
- No quedan tests automatizados en el repo que dependieran de estos mocks (confirmado, no hay `.test.ts`/`.spec.ts`), así que no hubo que preservar ninguna copia para pruebas aisladas.

### 2. Imágenes: ninguna URL no permitida llega a `next/image`

- Nuevo `lib/images/isAllowedImageSrc.ts`: `isAllowedImageSrc(url)` acepta solo assets locales (`/...`) o URLs `https` cuyo host coincide con `R2_PUBLIC_URL`; `sanitizeImageUrls(urls)` filtra un array. Rechaza cualquier otro host, incluido `*.supabase.co`.
- `next.config.mjs` ahora expone `NEXT_PUBLIC_R2_PUBLIC_URL` (espejo de `R2_PUBLIC_URL`, ya pública por diseño) vía `env`, para que el chequeo funcione igual en Server y Client Components sin pedir ninguna variable nueva. De paso se quitaron `placehold.co`/`picsum.photos` de `remotePatterns` (solo los usaban los mocks recién eliminados).
- Nuevo `components/ui/SafeImage.tsx`: wrapper de `next/image` que renderiza un placeholder (`bg-gradient` neutro) si `isAllowedImageSrc(src)` es falso, en vez de dejar que `next/image` rompa el render.
- Aplicado en todos los puntos donde se muestra una imagen de producto o de carrito: `ProductCard`, `StickyAddToCart`, `ProductClient` (galería — ahora sanea el array completo, no solo la portada), `CheckoutRecommendations`/`CartDrawer` (offers, vía saneo en el API), `CartDrawer`/`app/(store)/carrito/page.tsx` (imagen de línea de carrito, sin ningún guard antes — con `SafeImage`), `CheckoutClient` (guard con `isAllowedImageSrc`), listado admin de productos, editor de producto existente (preserva `unoptimized` para previews `blob:` de imágenes recién seleccionadas), home (`landing-home-catalog.ts` sanea el catálogo completo en el origen), `/api/upsells` y `/api/checkout/recommendations` (sanean antes de responder).
- **Probado en vivo**: se insertó un producto de prueba con `images: ['https://<ref>.supabase.co/...']` directo en Neon — `/productos` y `/productos/[slug]` devuelven `200` (antes rompía), el `_next/image` optimizer nunca recibe esa URL (se confirmó con grep sobre el HTML servido), y la única aparición de la URL vieja queda en metadata (`og:image`, no pasa por el optimizador de imágenes, no rompe nada). Producto de prueba borrado después de verificar.
- Deliberadamente **no** se restringió a solo-R2 el campo `photo_url` de reseñas ni las imágenes de los bloques de contenido admin (`MediaStripSection`/`BeforeAfterSection`) — son campos de URL libre por diseño (el admin/cliente puede enlazar cualquier imagen externa), no vienen de datos mock, y restringirlos habría sido un cambio de comportamiento no pedido.

### 3. Carrito endurecido (`lib/cart/store.ts`)

- Nueva validación `sanitizePersistedCartItem()`: descarta líneas sin `product_id` con forma de UUID válida (los productos reales siempre tienen UUID; esto es lo que filtra IDs de mocks viejos como `"prod-1"` o cualquier dato corrupto/manipulado), sin `name`, o con `price` no numérico/negativo. `quantity` inválida se corrige a `1` en vez de descartar la línea. `image` se sanea con `isAllowedImageSrc` (URL inválida → `""`, nunca se pierde el resto de la línea por una imagen rota).
- `migrate()` de `persist` (bump `version: 5 → 6`) ahora usa `sanitizePersistedCartItem` en cada línea y está envuelto en try/catch que nunca propaga (devuelve `{ items: [] }` ante cualquier forma inesperada) — aunque zustand ya envuelve `migrate` en un catch interno (confirmado leyendo `node_modules/zustand/esm/middleware.mjs`: un JSON corrupto o un `migrate` que lanza ya caían de forma segura al estado inicial vacío, sin romper la carga de la página), se añadió de todos modos como defensa explícita y para poder loguear el error en dev vía `onRehydrateStorage`.
- `add()` ahora también valida `product_id` (rechaza con `return false` si no es UUID), y `normalizeIncomingCartItem` coacciona `price`/`quantity` a números finitos siempre, no solo en la migración.
- **Probado** con un harness que llama `sanitizePersistedCartItem` directamente (vía `tsx`) contra 12 casos: `null`, `undefined`, string suelto, objeto vacío, `product_id` tipo mock (`"prod-1"`), UUID válido sin nombre, `price` no numérico, `price` negativo, imagen de host no permitido, `quantity` 0, `quantity` como string, y un item totalmente válido — los primeros 7 se descartan (`null`), la imagen de host inválido se limpia a `""` sin perder la línea, `quantity` se corrige a `1`/se castea a número, y el item válido pasa intacto.

### 4. Script de creación de admin: reescrito para ser interactivo y seguro

- `scripts/create-admin-user.ts`: ahora pide **email y contraseña por consola** (ya no acepta `--email=`/`--password=` ni `ADMIN_SEED_*` — nada de valores por defecto inventados). La contraseña se pide dos veces (confirmación) con entrada oculta en una terminal real (`stdin.isTTY`, raw mode sin eco — no se imprime ni un asterisco); si no hay TTY (ej. pipe) cae a un prompt normal de `readline`, documentado en el propio código.
- Si el email ya existe, muestra rol/estado actual y exige escribir literalmente `"SI"` para confirmar la sobrescritura; cualquier otra respuesta cancela sin tocar la fila. Si es nuevo, se crea directamente (`createAdminUser`, no el `upsertAdminUserByEmail` silencioso que se usaba antes).
- Rol por defecto: `owner` si es el primer admin de la base (detectado con `listAdminUsers()`), `admin` en el resto de los casos; validado contra `owner`/`admin`/`operator`.
- Nunca se imprime la contraseña ni su hash (se limpia la variable en memoria apenas se hashea con bcrypt cost 12, mismo costo que el resto del proyecto).
- Nuevo script npm: `npm run admin:create` (ejecuta `tsx scripts/create-admin-user.ts`).
- **Probado end-to-end** contra la base real (con un email/contraseña de prueba, borrados después): creación del primer admin (rol `owner` por defecto), rechazo de sobrescritura al responder distinto de `SI` (no modificó `updated_at`), y login exitoso contra `/api/admin/login` con la contraseña creada.
- **Comando para crear el primer admin** (documentado también más abajo en el resumen final):
  ```
  npm run admin:create
  ```

### 5. `store_settings`: valores neutros + auto-inicialización real

- `DEFAULT_STORE_SETTINGS` (`lib/store-settings/getStoreSettings.ts`) dejó de tener branding de PonkyBonk (`store_name: "PonkyBonk"`, tagline "Todo para gatos felices", preset `pets_purple_pink`, Instagram/TikTok `@ponkybonk`, WhatsApp `56900000000` inventado): ahora son valores neutros (`"Mi Tienda"`, sin tagline, `theme_preset: "custom"`, sin redes ni WhatsApp, `enable_whatsapp_fab: false`).
- `getStoreSettings()` ya no se limita a devolver ese objeto en memoria cuando no hay fila: ahora llama a una nueva `ensureStoreSettingsRow()` que **inserta una fila real** con esos valores neutros la primera vez que se necesita. `uq_store_settings_singleton` (índice único sobre `(true)`) garantiza a nivel de Postgres que nunca hay más de una fila; ante una carrera entre dos requests concurrentes, la segunda inserción falla con `23505` (unique violation) y simplemente se relee la fila que ya insertó la primera (mismo patrón `isUniqueViolation` que ya existía en `lib/clientes/upsertClienteFromOrder.ts`). El panel admin sigue siendo la fuente de verdad para cualquier cambio posterior.
- **Probado**: con `store_settings` vacía, cargar el home creó la fila automáticamente; verificado por SQL directo que quedó con `store_name: 'Mi Tienda'`, `theme_preset: 'custom'`, `primary_color: '#111111'`, `support_whatsapp: null`, `order_number_offset: 0` — nada de PonkyBonk.

### 6. Copy hardcodeado de PonkyBonk retirado de componentes compartidos del storefront

No solo el home (`app/(store)/page.tsx`, metadata y las dos secciones de problema/solución): el copy de marca estaba repetido en varios componentes que se renderizan en **todas** las páginas de la tienda, no gateados por `store_settings`:
- `components/store/Hero.tsx`: "Soluciones premium para gatos felices" / "Elimina el olor de tu gato desde el primer uso" / "Entrega rápida en Rancagua" / link roto a `/#packs-ahorro` (esa ancla no existe en ninguna página) → copy neutro genérico, link corregido a `/productos`.
- `components/store/PromoTickerBar.tsx`: barra de anuncios con las mismas frases de gatos/Rancagua → copy neutro.
- `components/store/TrustBadges.tsx`: "Rancagua y alrededores" → "A todo el país".
- `components/store/Footer.tsx`: línea fija "Entrega rápida en Rancagua y alrededores" concatenada después del tagline (aunque el tagline esté vacío) → se quitó, el footer ahora solo muestra el tagline si existe.
- Plantillas de email (`lib/email/templates/{orderAdmin,orderCustomer,reviewPending}.ts`): fallback `|| "PonkyBonk"` → `|| "Mi Tienda"`.
- **Verificado con grep sobre el HTML servido en vivo** (home + footer + navbar): cero coincidencias de "gato", "Rancagua" o "PonkyBonk" tras los cambios.
- **Deliberadamente no tocado** (fuera de alcance — no es un fallback de estado vacío, es contenido/lógica de negocio explícita, no relacionado a ninguno de los 5 bugs reportados):
  - `app/(store)/nosotros/page.tsx`: página editorial completa narrando el origen de "PonkyBonk" — reescribirla es una decisión de copywriting del dueño de la tienda, no un bug.
  - `app/(store)/checkout/CheckoutClient.tsx`: el checkout tiene la región de despacho **fija** a "Libertador General Bernardo O'Higgins" (comunas: Rancagua, Machalí, Graneros) — es una restricción de cobertura deliberada y ya documentada en el propio código (`FIXED_REGION`, con instrucciones de cómo generalizarla a las 16 regiones si se necesita). Es lógica de checkout comercial real, explícitamente fuera del alcance de esta sesión.
  - `components/store/SocialProof.tsx` y `SocialProofToast.tsx`: testimonios fabricados (nombres, ciudades, "500 clientes en Rancagua") — confirmado con `rg` que **ninguno de los dos se importa en `app/`**, son código muerto que nunca se renderiza. Se dejan documentados acá por si se quiere borrar en una limpieza futura, pero no afectan ningún flujo real.
  - `app/admin/configuracion/page.tsx`: un `placeholder="PonkyBonk"` en el input de nombre de tienda — es solo un texto de ejemplo en el placeholder del formulario, no un valor real.

### 7. `order_number_offset`: default de columna corregido

- El default de la columna en `store_settings` era `1007398` (arrastrado de la numeración de pedidos real de PonkyBonk producción) — para una tienda nueva esto habría hecho que el primer pedido se mostrara como `SO01007399` en vez de `SO00000001`.
- `lib/db/schema/storeSettings.ts`: default cambiado a `0`. Migración nueva `drizzle/0002_fix-order-number-offset-default.sql` (`ALTER TABLE store_settings ALTER COLUMN order_number_offset SET DEFAULT 0`), generada con `npx drizzle-kit generate` y aplicada directamente a la base de desarrollo (verificado por `information_schema.columns`).

### Verificación final de esta fase

- `npx tsc --noEmit`: 0 errores.
- `npm run build`: 63 rutas, build exitoso.
- Con Neon vacío: home y catálogo cargan sin mocks (confirmado por logs `products count: 0`); carrito vacío y con una línea válida sin errores; login admin tras crear el primer admin con `npm run admin:create`; producto creado con imagen real de R2 se muestra correctamente (`/_next/image` sirve la URL de R2); producto con URL vieja de Supabase no rompe la página (fallback visual, `200`). Todos los datos de prueba (productos, admin de prueba, objeto subido a R2) se borraron al terminar — la base queda con `products: 0`, `admin_users: 0`, `store_settings: 1` (fila neutra, autogenerada).

## Fase 12 — Bug de persistencia en `store_settings` (completada)

### Causa raíz, con evidencia

`getStoreSettings()` (llamada en casi todas las páginas: home, layout de admin, `/admin/configuracion`, checkout) tenía esta lógica: si `getStoreSettingsRow()` no encuentra fila, llama a `ensureStoreSettingsRow()` para crear una fila neutra. Esa función usaba `upsertStoreSettings(...)`, la **misma** función que usa el guardado real del admin — y `upsertStoreSettings` hacía `SELECT` (¿existe una fila?) y **luego**, en un segundo round-trip separado, `INSERT` o `UPDATE` según el resultado. Dos consultas no atómicas, sin transacción.

Esto significa que **"crear la fila neutra si no existe" y "sobrescribir con los valores reales del admin" eran, en la práctica, la misma operación** (un `UPDATE` sobre la fila existente). Si dos requests concurrentes llegaban a esas dos líneas de código casi al mismo tiempo — por ejemplo, el guardado real del admin desde `/admin/configuracion`, y en paralelo cualquier otra página (`/`, el layout de `/admin/*`, un Fast Refresh que re-ejecuta el Server Component) que también llamara `getStoreSettings()` — ambas terminaban llamando a `upsertStoreSettings`. Cuál de las dos ganaba la carrera era impredecible; si la del admin escribía primero y la de "inicialización" escribía después, el resultado visible era exactamente el síntoma reportado: **el guardado se ve correcto por un instante y luego vuelve a los valores neutros**, porque la segunda escritura (con los defaults neutros) pisó la primera (con los valores reales).

Confirmado con una prueba directa reproduciendo la carrera (ver más abajo): con el código viejo, disparar varias llamadas concurrentes de "inicialización" contra una fila que ya tenía datos reales guardados terminaba sobrescribiéndola con los valores neutros. Con el código nuevo, la misma prueba deja la fila real intacta.

Se revisó también: el schema (una sola tabla, sin ORM secundario), el `SaveSettingsForm`/`ThemeLivePreview` del cliente (no tienen estado que reescriba la respuesta del servidor — el preview solo lee del formulario en vivo, nunca del servidor después de guardar), y `router.refresh`/efectos (no se usan; el refresco post-guardado depende únicamente de `revalidatePath`, que ya funcionaba bien). El problema estaba enteramente en el backend, no en React.

### Regla robusta implementada

`lib/db/repositories/storeSettings.ts`:
- **Id fijo y conocido** para la fila única: `STORE_SETTINGS_SINGLETON_ID = "00000000-0000-0000-0000-000000000001"`, en vez de un UUID aleatorio por fila. Es lo que permite usar `ON CONFLICT (id)` con la API tipada de Drizzle (`onConflictDoUpdate`/`onConflictDoNothing` solo aceptan columnas reales como target, no expresiones — por eso no se podía apuntar directamente al índice `uq_store_settings_singleton`, que es sobre la expresión `(true)`; ese índice se conserva igual como segunda barrera a nivel de BD).
- **`upsertStoreSettings(input)`** (guardado explícito del admin, `/admin/configuracion` + páginas de marketing): ahora es **una sola sentencia** `INSERT ... ON CONFLICT (id) DO UPDATE SET ...`, atómica — sin ventana entre "verificar" y "escribir". Sigue siendo la única función que puede sobrescribir intencionalmente.
- **`ensureStoreSettingsRowExists(neutralDefaults)`** (nueva función, reemplaza el uso de `upsertStoreSettings` dentro de la auto-inicialización): `INSERT ... ON CONFLICT (id) DO NOTHING`. Si la fila ya existe —con cualquier valor—, el insert no hace nada; nunca sobrescribe. Devuelve `{ row, created }` para poder loguear si realmente se creó.
- **`getStoreSettingsRow()`**: ahora busca por `WHERE id = <singleton>` en vez de `ORDER BY updated_at DESC LIMIT 1` (más explícito y no depende de que los timestamps estén bien ordenados).
- **`countStoreSettingsRows()`** (nueva, solo diagnóstico): cuenta filas reales en la tabla.

`lib/store-settings/getStoreSettings.ts`: `ensureStoreSettingsRow()` ahora llama a `ensureStoreSettingsRowExists` (nunca a `upsertStoreSettings`) — ya no hay ningún camino de lectura que pueda terminar sobrescribiendo datos.

Regla resultante, tal como la pidió la tarea: existe exactamente una fila (garantizado por PK fija + `ON CONFLICT`, con el índice `(true)` como respaldo); la inicialización (`ensureStoreSettingsRowExists`) solo crea si no existe, nunca sobrescribe; el guardado del admin (`upsertStoreSettings`) sí actualiza esa misma fila de forma atómica; la lectura (`getStoreSettingsRow`) siempre devuelve la fila por su id fijo.

### Migración de datos

`drizzle/0003_normalize-store-settings-singleton-id.sql` (migración `--custom`, sin cambio de esquema — no hace falta `ALTER TABLE`, la columna `id` sigue siendo `uuid`): `UPDATE store_settings SET id = '00000000-0000-0000-0000-000000000001' WHERE id <> '00000000-0000-0000-0000-000000000001'`. Segura por diseño: como `uq_store_settings_singleton` garantiza que nunca hay más de una fila, este `UPDATE` solo renombra el id de la fila que ya existía (si existía alguna) — no se borró ni se duplicó ningún dato. Aplicada a la base de desarrollo; verificado antes/después que el `store_name`/`theme_preset` reales no cambiaron, solo el `id`.

### Logs de desarrollo (sin secretos, sin ruido en producción)

Todos gateados por `process.env.NODE_ENV !== "production"`:
- `[store_settings] fila neutra creada por primera vez (id=...)` — solo la primera vez que la tabla está vacía.
- `[store_settings] guardado por admin (id=...)` — cada vez que `upsertStoreSettings` corre (guardado real, no lecturas).
- `[store_settings] ninguna fila encontrada, creando fila neutra inicial` — antes de crear la fila inicial.

Se **eliminaron** los logs viejos que disparaban en cada render (`[hero-config-load] mobile url from store_settings: ...` en `ConfiguracionPage`, y los tres `[hero-config-save]` por cada guardado) — eran exactamente el ruido que el usuario reportó viendo repetidamente en la consola con Fast Refresh. Confirmado en la prueba: 8 requests concurrentes a `/` no generaron ninguna línea de log (antes, cada una habría impreso `[hero-config-load]`).

### Verificación con evidencia (contra Neon real, no simulada)

1. **Estado inicial**: 1 fila, `store_name: 'Mi Tienda'` (ya en valores neutros al empezar — ver nota abajo).
2. **Guardado real de prueba**: `upsertStoreSettings({store_name: "Tienda De Prueba XYZ", theme_preset: "premium_dark", ...})` → confirmado guardado por lectura directa.
3. **Carrera reproducida**: 5 llamadas **concurrentes** a `ensureStoreSettingsRowExists(neutralDefaults)` (exactamente lo que dispara la auto-inicialización) contra la fila con datos reales → las 5 devuelven `created: false` y la fila **no cambia** (sigue "Tienda De Prueba XYZ" / "premium_dark"). Con el código viejo, esta misma prueba sobrescribía la fila con los defaults neutros.
4. **10 guardados concurrentes** con nombres distintos (simula dos admins guardando a la vez) → sigue existiendo **1 sola fila** (sin duplicados), gana uno limpiamente (last-write-wins, comportamiento correcto y esperado para ediciones concurrentes al mismo recurso singleton).
5. **Contra el servidor real** (`npm run dev`): se fijaron valores reales de prueba (`store_name: "Tienda Real De Prueba"`, `theme_preset: "natural_green"`) directo en Neon; `curl http://localhost:3000/` mostró el título `Tienda online | Tienda Real De Prueba` (confirma que el home lee la fila real). Se mató el proceso de `npm run dev` y se volvió a levantar (reinicio real, no simulado): los valores **siguieron intactos** tras el reinicio, con 1 sola fila. 8 requests concurrentes a `/` inmediatamente después del reinicio (el momento de mayor riesgo de carrera) tampoco alteraron ni duplicaron nada.
6. **Limpieza**: los valores de prueba (`"Tienda De Prueba XYZ"`, `"Tienda Real De Prueba"`, etc.) se restauraron a los neutros (`"Mi Tienda"`, `theme_preset: "custom"`, etc.) — el mismo estado en el que se encontró la fila al empezar esta investigación. No se alteró ninguna configuración real del usuario (la fila ya estaba en neutro cuando se empezó a investigar; no había datos de producción que preservar más allá del `id`, que sí se preservó explícitamente vía la migración de normalización).
7. `npx tsc --noEmit` y `npm run build`: sin errores.

### No se tocó (fuera de alcance)

`SaveSettingsForm.tsx`, `ThemeLivePreview.tsx` (revisados, sin bugs — ver arriba), las páginas de marketing (`/admin/marketing/meta`, `/admin/marketing/clarity`, siguen llamando a `upsertStoreSettings` sin cambios en su propio código, se benefician automáticamente de que ahora es atómico), y el índice `uq_store_settings_singleton` (se mantiene intacto como segunda barrera).

## Bloqueos externos

Ninguno pendiente. `CRON_SECRET` se generó automáticamente en la Fase 5. R2 verificado en Fase 6.
