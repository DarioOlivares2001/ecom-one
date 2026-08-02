# Auditoría de complejidad: TheGate de single-store a multi-tenant

Fecha del análisis: 2026-07-24. Alcance: solo lectura del código en `c:\proyectos\thegate` (rama `main`, working tree con los cambios de favicon/logo aún sin commitear). **No se modificó ningún archivo de código para este informe.**

Metodología: cada afirmación de la sección "Contexto del negocio" del pedido fue verificada contra el código real antes de darla por buena. Donde el código contradice o matiza lo asumido, se marca explícitamente con **⚠️ Corrección**.

---

## 0. Resumen ejecutivo

- **Veredicto de complejidad: ALTA**, pero por *superficie* (cantidad de puntos a tocar), no por dificultad algorítmica. No hay ningún problema irresoluble; hay ~40+ archivos con acceso directo a Supabase que hoy no filtran por tienda, y cero capa de plantillas.
- Lo bueno: el webhook de Flow, el `display_code` y el RPC de stock **ya funcionan de forma segura para una cuenta Flow compartida**, sin cambios, siempre que el correlativo se mantenga global (ver §5).
- Lo que falta por completo: no existe tabla `stores`, no existe columna `store_id` en ninguna tabla, no existe resolución de tienda por dominio, no existe capa de plantillas, y `store_settings` asume una única fila para todo el proyecto.
- El mayor costo no es técnico sino de **disciplina de ejecución**: no hay una capa de datos centralizada, así que cada uno de los ~40 archivos que llaman `createAdminClient()` hay que auditarlo y tocarlo a mano.

---

## 1. Arquitectura actual

### Acceso a Supabase: NO está centralizado

Existen 3 clientes en `lib/supabase/`:

| Archivo | Rol |
|---|---|
| `client.ts` | `createBrowserClient` (anon key) — componentes cliente de la tienda |
| `server.ts` | `createServerClient` (anon key + cookies) — server components de la tienda pública |
| `admin.ts` | `createAdminClient` (service_role, bypassa RLS) |

**No hay una capa de repositorio/data-access** (nada como `lib/data/orders.ts`, `lib/data/products.ts`) que centralice las consultas. Verifiqué cuántos archivos llaman `createAdminClient()` directamente y escriben su propio `.from(...)`:

```
41 archivos llaman createAdminClient() directamente
10 archivos hacen .from("products")
13 archivos hacen .from("orders")
4  archivos hacen .from("store_settings")
```

Esto es **el dato más importante de todo el informe**: convertir a multi-tenant significa auditar y editar manualmente cada uno de esos ~41 archivos (agregar `.eq("store_id", storeId)` a cada query, o pasar por un helper nuevo), porque no hay un único punto de intercepción. La mayoría de las queries están inline en Server Components (`page.tsx`), Server Actions (`actions.ts`) y Route Handlers (`route.ts`), muchas con `as any` porque `lib/supabase/types.ts` no cubre todas las tablas reales (ver §2).

`lib/store-settings/getStoreSettings.ts` es la única función que sí actúa como "capa compartida" real — la usan tanto el layout público como `recalculateCheckoutOrder` y varias rutas. Es un buen punto de apalancamiento: si `getStoreSettings()` recibe `storeId` como parámetro, todo lo que dependa de tema/branding/shipping/pixel se resuelve en un solo lugar. Pero eso NO resuelve products/orders/reviews/clientes, que se consultan directo en cada archivo.

### Estructura del proyecto

- **App Router** (Next.js 14), no Pages Router. Confirmado en `app/`.
- **Middleware existente** (`middleware.ts`): es mínimo. Solo intercepta rutas `/admin/:path*` y agrega un header `x-pathname` con el pathname. **No lee el host de la petición, no resuelve tienda, no hace nada relacionado a multi-tenant.** Este es el lugar natural donde iría la resolución por dominio (ver §5), pero hoy está vacío de esa lógica.
- **Rutas**: grupo `(store)` para la tienda pública (home, catálogo, producto, carrito, checkout, cuenta, seguimiento), `admin/` para el panel, `api/` para route handlers (flow, cron, cuenta, upload, admin).
- **Admin**: layout propio (`app/admin/layout.tsx`) con `AdminSidebar`, **no comparte layout con `(store)`** (relevante para que Pixel/Clarity no se monten ahí — ya verificado en una tarea anterior de esta sesión).

---

## 2. Modelo de datos

### ⚠️ Corrección importante antes de la lista: las migraciones NO son la fuente completa de verdad

Al recorrer `supabase/migrations/` encontré que dos tablas usadas activamente por la app **no tienen ningún `CREATE TABLE` en el repo**:

- **`clientes`** (cuentas de clientes, login, reset de password) — las migraciones `011` y `013` hacen `ALTER TABLE public.clientes ADD COLUMN...` pero la tabla en sí fue creada fuera del repo (directo en el dashboard de Supabase, probablemente).
- **`product_variants`** — usada por el RPC `confirm_paid_order_and_decrement_stock` (migración `017`) y por `lib/supabase/types.ts`, pero tampoco tiene `CREATE TABLE` en ninguna migración.

Consecuencia práctica: **no puedo confirmar desde el repo si estas dos tablas tienen RLS activo o qué políticas tienen** (ver estado de RLS más abajo — para estas dos, es una pregunta abierta, no un hecho verificado). Esto también significa que si alguien intentara reconstruir la base desde cero solo con `supabase/migrations/`, el proyecto no levantaría (fallaría el RPC de stock y todo `/cuenta/*`).

### (a) Tablas que pertenecen a una tienda específica

| Tabla | ¿Existe hoy `store_id` u otra columna de tienda? | Notas |
|---|---|---|
| `products` | No | Todo el catálogo es una sola tabla global. Incluye `discount_enabled`, `discount_steps`, `product_sections` (bloques modulares de ficha) — todo por producto, nada por tienda. |
| `product_variants` | No | Ver corrección arriba: tabla no versionada en migraciones. |
| `orders` | No | `order_number` es `SERIAL` (correlativo global de Postgres). `display_code` se calcula en código (ver §5), no se guarda una columna de tienda. |
| `reviews` | No | Ligada a `products`/`orders` por FK, sin concepto de tienda. |
| `customers` | No | **Tabla huérfana**: creada en `001_initial_schema.sql`, pero verifiqué con grep que **ningún archivo del código la consulta** (`from("customers")` → 0 resultados). Fue reemplazada de facto por `clientes` (español, con login/reset de password) sin que nadie borrara la original. Vale la pena limpiarla antes o durante la migración a multi-tenant para no arrastrar cruft. |
| `clientes` | No | Cuentas de cliente reales (la que sí se usa). Sin `CREATE TABLE` versionado (ver arriba). |
| `cliente_direcciones` | No | Direcciones guardadas, FK a `clientes`. |
| `store_settings` | No — y estructuralmente asume una sola fila | `getStoreSettings()` hace `.order("updated_at", desc).limit(1).maybeSingle()`: siempre trae **la fila más reciente**, sin ningún filtro. Hoy contiene: identidad/branding (nombre, tagline, logos, favicon, colores, fuentes, `theme_preset`), contacto (whatsapp, instagram, tiktok, email), hero banners + overlay, WhatsApp checkout/FAB, envío (`shipping_cost_clp`, `shipping_free_threshold_clp`), `order_number_offset`, Meta Pixel + CAPI (incluye un secreto: `meta_capi_access_token`), Microsoft Clarity. Es, de lejos, la tabla con más terreno ganado para convertirse en la fila "config de una tienda" — pero hoy es literalmente una tabla de una sola fila por diseño de la función que la lee. |
| `admin_users` | No | Pool único de administradores para todo el panel. Sin ningún concepto de "a qué tienda tiene acceso este admin". |

### (b) Tablas/recursos globales (correctamente compartidos, no deberían llevar `store_id`)

- Función `set_updated_at()` (trigger genérico).
- Bucket de Storage `store-assets` (banners, logos, favicons) y el bucket `products` (imágenes de producto) — **estos si necesitarían namespacing por tienda** en las *rutas* de los archivos (hoy `hero-banners/`, `logos/`, `favicons/` son prefijos planos sin ID de tienda; con multi-tenant y un solo bucket compartido, dos tiendas subiendo el mismo día podrían, en teoría, tener colisión de nombre si el timestamp coincidiera — bajo riesgo pero fácil de blindar con un prefijo `stores/{storeId}/...`).
- Cron (`vercel.json` → `/api/cron/cancel-stale-orders`, diario) — hoy es global; con multi-tenant en un solo deployment, esa ruta tendría que iterar todas las tiendas o dejar de asumir una sola configuración de "stale" (el umbral de expiración vive en código o en la única fila de `store_settings`, a confirmar).

### Estado de RLS (Row Level Security)

Verificado directamente en migraciones (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`):

| Tabla | RLS activo | Política |
|---|---|---|
| `products` | ✅ Sí (migración 001) | Lectura pública solo si `active = true`; mutación solo `service_role`. |
| `orders` | ✅ Sí (migración 001) | Insert anónimo permitido; update anónimo acotado (`status='pending' AND flow_token IS NULL`); select/update/delete solo `service_role`. |
| `reviews` | ✅ Sí (migración 001) | Lectura pública si `active`; insert público; update/delete solo `service_role`. |
| `customers` | ✅ Sí (migración 001) | Solo `service_role` (tabla huérfana, ver arriba). |
| `cliente_direcciones` | ✅ Sí (migración 012) | Solo `service_role`. |
| `admin_users` | ✅ Sí (migración 014) | Solo `service_role`. |
| `store_settings` | ✅ Sí (migración 003) | Solo `service_role`. |
| `clientes` | ❓ **No verificable desde el repo** | Sin `CREATE TABLE` versionado; no hay ningún `ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY` en las migraciones. Puede que exista y se haya activado a mano en el dashboard, o puede que no exista. **Hay que confirmarlo directo en Supabase antes de diseñar el RLS multi-tenant.** |
| `product_variants` | ❓ **No verificable desde el repo** | Mismo caso que `clientes`. |

En la práctica hoy, el 100% de las lecturas/escrituras reales de la app pasan por `service_role` (`createAdminClient()`), que **bypassa RLS por completo**. Las políticas RLS existentes protegen contra un cliente anónimo directo (alguien pegándole a la API REST de Supabase con la anon key), pero no son la barrera que usa la propia aplicación. Esto importa mucho para §6.

---

## 3. Cuánto asume el código que hay una sola tienda

Grep de `store_id` / `tenant` / `stores` en todo `app/`, `lib/`, `components/` y `supabase/migrations/`: **0 resultados.** No hay ni un solo lugar en el repo que contemple más de una tienda, ni siquiera como flag apagado.

### Hardcodeos concretos encontrados

- **Región fija**: `app/(store)/checkout/CheckoutClient.tsx:103` — `const FIXED_REGION = "Libertador General Bernardo O'Higgins" as const;`, con `ALLOWED_COMMUNES` limitado a `["Rancagua", "Machalí", "Graneros"]`. El array completo `CHILE_REGIONS` se dejó sin usar (con `eslint-disable-next-line` explícito) a propósito, para poder revertir esto en un clon nacional — ya estaba pensado como algo "por tienda". **⚠️ Hallazgo no descrito por el usuario**: esta restricción **solo se aplica en el cliente** (el formulario). Verifiqué `app/api/flow/create/route.ts` y no hay ninguna revalidación server-side de región/comuna contra la lista permitida — el servidor acepta y guarda lo que el cliente mande. Bajo riesgo de seguridad (es shipping, no dinero), pero es un hueco a cerrar si esta restricción pasa a depender de datos por tienda.
- **`display_code`**: confirmado formato `"SO" + 8 dígitos` (`lib/orders/generateDisplayCode.ts`), calculado como `orderNumber + offset`, donde `orderNumber` viene de `orders.order_number` (columna `SERIAL`, correlativo **global** de Postgres) y `offset` de `store_settings.order_number_offset` (hoy un único valor global, default `0`). Ver análisis de colisión en §5.
- **Variables de entorno que asumen una sola tienda**: `NEXT_PUBLIC_SITE_URL` (una URL canónica por deployment, usada en Flow y emails), `FLOW_API_KEY`/`FLOW_SECRET_KEY` (una cuenta Flow — esto coincide con lo que pediste, cuenta paraguas), `ADMIN_EMAIL`, `RESEND_API_KEY`. Todo vive en `.env`, es decir, **una configuración por deployment de Vercel**, no por tienda dentro del mismo deployment.
- **`getStoreSettings()`**: como ya se dijo, trae "la fila más reciente" sin filtro — el ejemplo más directo de asunción single-tenant en código de producción activo (se llama desde `app/layout.tsx`, `app/(store)/layout.tsx`, `app/(store)/page.tsx`, `app/manifest.ts`, checkout, emails, pixel, etc. — es decir, decenas de puntos de entrada dependen de esta única función).
- **Copy hardcodeado del nicho** (gatos/PonkyBonk), no solo en Home: encontré referencias directas al nicho "gato" en **12 archivos**, no solo `page.tsx`:
  `app/(store)/checkout/CheckoutClient.tsx`, `app/(store)/nosotros/page.tsx`, `app/(store)/page.tsx`, `app/(store)/productos/[slug]/ProductClient.tsx`, `app/admin/configuracion/ThemeLivePreview.tsx`, `app/admin/configuracion/page.tsx`, `components/store/Hero.tsx`, `lib/checkout/recommendations.ts`, `lib/email/templates/orderAdmin.ts`, `lib/email/templates/orderCustomer.ts`, `lib/email/templates/reviewPending.ts`, `lib/store-settings/getStoreSettings.ts` (el propio `DEFAULT_STORE_SETTINGS.store_name = "PonkyBonk"`, que es un fallback razonable, no un problema).
- **`lib/config/features.ts`**: flags como `SHOW_CART_UPSELLS` y `SHOW_VOLUME_DISCOUNTS` son **constantes de código**, compartidas por todo el deployment — no viven en `store_settings`. Si dos tiendas del mismo deployment quisieran comportamientos distintos, hoy no podrían (a diferencia de, por ejemplo, `enable_whatsapp_checkout`, que sí es un campo de BD).

### Consultas/mutaciones que tocan datos de tienda y HOY no filtran por tienda (el corazón del trabajo)

Prácticamente el 100% de las ~41 llamadas a `createAdminClient()` caen en esta categoría, porque no existe la columna que filtrar. Los grupos más relevantes por volumen de cambio:

1. **Catálogo**: `app/admin/productos/*`, `app/api/productos/route.ts`, `app/(store)/productos/**`, `lib/store/landing-home-catalog.ts`, `lib/product/upsell.ts`, `lib/checkout/recommendations.ts` — cualquier `SELECT`/`INSERT`/`UPDATE` sobre `products`/`product_variants`.
2. **Pedidos**: `app/admin/pedidos/**`, `app/api/flow/create/route.ts`, `app/api/flow/webhook/route.ts`, `app/api/orders/*`, `app/api/cron/cancel-stale-orders/route.ts`, `lib/orders/getPublicOrderByNumber.ts`.
3. **Clientes/cuentas**: los 12 archivos bajo `app/api/cuenta/**` + `app/(store)/cuenta/**` + `lib/clientes/*`.
4. **Configuración/branding**: `app/admin/configuracion/page.tsx`, `app/admin/marketing/**`, `lib/store-settings/getStoreSettings.ts`.
5. **Reseñas**: `app/admin/resenas/**`, `app/api/reviews/route.ts`.
6. **Admin/usuarios**: `app/admin/usuarios/page.tsx`, `app/api/admin/users/**`, `app/api/admin/login/route.ts`.

No hay atajos: cada uno de estos puntos necesita, como mínimo, un `.eq("store_id", storeId)` agregado a mano (o pasar por un wrapper nuevo que lo inyecte).

---

## 4. Capa de diseño / plantillas

### Acoplamiento actual: total, sin ninguna abstracción de plantilla

- `app/(store)/page.tsx` (Home) es una página server-component con **secciones y copy 100% hardcodeados en JSX** ("¿Te pasa esto con tu gato?", "La solución está en usar productos que realmente funcionan", etc.) — no hay ningún mecanismo de "bloques configurables" a nivel de Home (a diferencia de la ficha de producto, que sí tiene `product_sections` JSONB por producto desde la migración `018`).
- El layout de la tienda (`app/(store)/layout.tsx`) es un único árbol fijo: `PromoTickerBar → Navbar → children → Footer → CartDrawer → WhatsAppFab → Toaster`, más los scripts de tracking. No hay forma de que una tienda decida "yo no quiero PromoTickerBar" o "mi Navbar va abajo" sin tocar código compartido.
- **No existe hoy ningún campo `template` en ninguna tabla**, ni ningún registro/mapa de componentes por tienda. La idea que propones (un campo `template` en la tabla de tiendas + un mapa de componentes en código) **no tiene ningún precedente parcial en el repo** — hay que construirla desde cero, pero conceptualmente encaja bien con cómo ya está resuelto `product_sections` (un array JSON de bloques con `{ id, type, enabled, order, data }`, validado con Zod en el server) — ese patrón ya demuestra que el equipo sabe construir este tipo de sistema, solo que aplicado a nivel de producto, no de tienda completa.

### Qué es "tema" vs qué es "plantilla" hoy

| Ya es dato (tema, en `store_settings`) | Hoy es código (estructura/plantilla) |
|---|---|
| Colores (`primary_color`, `accent_color`, `background_color`, etc.), fuentes (`font_heading`, `font_body`), `theme_preset`, logos, favicon, `branding_mode`, posición de navbar/marca, banners hero + modo de overlay | La composición completa de Home (`app/(store)/page.tsx`): qué secciones existen, en qué orden, con qué copy |
| Textos de contacto/redes, WhatsApp checkout/FAB | El layout raíz de la tienda (`app/(store)/layout.tsx`): qué componentes envuelven a las páginas |
| Envío (costo, umbral gratis), `order_number_offset` | `ProductClient.tsx`: layout de galería, cómo se muestran descuentos por volumen/upsells (la lógica en sí sí es reusable — `lib/product/upsell.ts`, `lib/discounts.ts` — pero la disposición visual está fija en un solo componente) |
| Pixel/Clarity (IDs, toggles) | El propio `CheckoutClient.tsx` (región fija, comunas — hoy hardcode, no dato) |

Esto confirma tu premisa: **checkout, carrito, admin y webhook ya son, en los hechos, piezas compartidas y desacopladas del "tema"** — no tienen copy de nicho embebido más allá de un par de textos sueltos (`lib/checkout/recommendations.ts` sí tiene alguna referencia a "gato", habría que neutralizarla). El problema real está concentrado en **Home, product detail (layout, no lógica) y el layout raíz de la tienda**.

### Viabilidad de un sistema de plantillas + carga dinámica por dominio en SSR

Es viable y es el patrón estándar para este problema (similar a cómo Shopify/multi-tenant Next.js apps resuelven "theme app extensions"). El esquema técnico:

1. Middleware lee el host → resuelve `storeId`/`storeSlug` (una tabla nueva `stores` con `domain` único) → lo propaga como header interno (`x-store-id`) en la request reescrita, igual que ya hace con `x-pathname`.
2. Cada Server Component raíz (Home, layout) lee ese header (via `headers()` de `next/headers`, que sí funciona en Server Components) y con eso resuelve `store.template` desde la tabla `stores`.
3. Un mapa de componentes en código (`lib/templates/registry.ts`, por ejemplo `{ pets_default: HomePetsTemplate, tech_default: HomeTechTemplate }`) selecciona el componente a renderizar. **Esto no rompe SSR**: sigue siendo un Server Component eligiendo qué otro Server/Client Component renderizar, exactamente el mismo patrón que ya usa Next.js para todo lo demás.
4. Riesgo real: **no confundir "middleware decide" con "componente decide"**. El middleware solo debe resolver identidad de tienda (barato, corre en Edge); la resolución de qué plantilla renderizar debe vivir en el Server Component (necesita leer la BD, no debería hacerse en Edge middleware por latencia/limitaciones de runtime).

### Riesgo de mantenimiento y número sano de plantillas

Con "plantillas de verdad" (no solo temas) el costo no escala linealmente: cada plantilla nueva es esencialmente un fork de Home/Product/Layout que hay que mantener por separado ante cualquier cambio de checkout/carrito compartido que la toque tangencialmente. Recomendación: **2-3 plantillas base como techo inicial** (ej. "editorial/hero grande" tipo PonkyBonk actual, "catálogo denso" tipo tienda con muchos SKUs, "servicio/landing" con menos catálogo y más storytelling). Más de eso sin una razón de negocio concreta por cliente/nicho vuelve el mantenimiento comparable a mantener N apps distintas — perderías el punto de tener un motor único.

---

## 5. Puntos críticos, uno por uno

### Resolución por dominio

No existe hoy. `middleware.ts` es el lugar correcto (ya intercepta todo, ya reescribe headers), pero hoy solo mira `pathname`, nunca `request.nextUrl.hostname` ni headers de host. Habría que:
- Agregar una tabla `stores` (id, domain, slug, template, activo).
- En el middleware, resolver `hostname → store` (con cache, porque el middleware corre en cada request — probablemente un fetch a un edge-config o una tabla pequeña cacheada, no una query a Postgres en cada hit).
- Propagar `store_id` vía header interno a todo Server Component/Route Handler downstream.

### Webhook de Flow (cuenta compartida)

**Este es mejor noticia de lo que tu descripción sugiere.** Verifiqué `app/api/flow/webhook/route.ts` completo: Flow devuelve `commerceOrder` en la respuesta de `getStatus`, y el webhook busca la orden con:
```ts
.from("orders").select(...).eq("display_code", commerceOrder).maybeSingle()
```
con un fallback a `order_number` para órdenes legacy con formato `"TG-X"`. **La tienda se deriva 100% desde el pedido encontrado**, no hay ninguna ambigüedad de "a qué tienda pertenece este pago" — el pedido ya tiene todos sus datos (dirección, items, cliente). El riesgo de "pago asignado a la tienda equivocada" **no existe hoy porque no hay noción de tienda en absoluto**; y una vez que exista `store_id` en `orders`, el webhook simplemente hereda ese `store_id` de la fila que ya encontró — **no necesita lógica nueva para saber de qué tienda es el pago**, siempre y cuando `display_code`/`order_number` sigan siendo globalmente únicos (ver punto siguiente). El único cambio real necesario acá es leer `store_id` de la fila encontrada para, por ejemplo, elegir la plantilla de email correcta o el `meta_pixel_id` correcto al enviar el CAPI Purchase.

### `display_code`: ¿global o por tienda?

Analicé la colisión: `order_number` es un `SERIAL` de Postgres — **un único contador atómico a nivel de tabla**, sin condición de carrera posible entre tiendas porque Postgres serializa los `nextval()` internamente. Si **se mantiene un único `orders.order_number` global para todas las tiendas**, no hay colisión posible, y el webhook (que matchea por `display_code`) sigue funcionando sin cambios.

El riesgo aparece **solo si decides que cada tienda quiera su propio correlativo empezando en 1** (razonable desde el punto de vista de negocio: el dueño de la tienda B no quiere ver "pedido #4.128" como su primer pedido). En ese caso, `display_code` dejaría de derivarse de una `SERIAL` compartida y necesitarías:
- Un contador por tienda (columna `store_order_seq` en `stores`, incrementada con `SELECT ... FOR UPDATE` o una secuencia de Postgres por tienda), y
- **`display_code` tendría que dejar de ser el único identificador que usa el webhook para encontrar la orden** — se necesitaría un prefijo de tienda embebido en el propio código (ej. `SO-{storeSlug}-00000086`) o volver a matchear por `orders.id` (UUID global, ya único) en vez de por `display_code`.

Mi recomendación: **no mezcles las dos cosas**. Deja `orders.id` (UUID) como la clave real que usa el webhook internamente (ya lo es, `display_code` solo se usa para el primer lookup desde `commerceOrder`), y decide `display_code` como una decisión de producto/negocio, no de integridad — puede seguir siendo global, o pasar a incluir un prefijo de tienda, sin que eso afecte la seguridad del webhook.

### Admin

Autenticación 100% propia (no usa Supabase Auth): tabla `admin_users` (email, `password_hash` con bcrypt, `role` con CHECK `owner|admin|operator`), sesión firmada con HMAC-SHA256 en una cookie httpOnly (`lib/admin/session.ts`), sin expiración corta (12 horas). **El payload de sesión no tiene ningún concepto de tienda** — es puramente `{id, email, role, iat, exp}`.

Hoy un admin ve todo (no hay "todo" que ver más que una tienda). Con multi-tenant hay que decidir un modelo de producto antes que uno técnico: ¿un admin de PonkyBonk debería poder loguearse y ver la tienda de otro nicho? Mi lectura del pedido original (dueño único operando varias tiendas de nicho) sugiere que sí conviene un selector de tienda dentro de una única sesión, en vez de cuentas separadas por tienda — pero es una decisión de producto, la dejo en §8 como pregunta abierta. Técnicamente ambas son viables: agregar `store_id` (nullable = acceso a todas) a `admin_users`, o una tabla puente `admin_user_stores`.

Casi todo `/admin/*` necesita scopearse: dashboard (métricas), pedidos, productos, reseñas — todo lo listado en §3.

### `store_settings`: qué más debería moverse ahí

Ya contiene casi todo lo "tema" (branding, contacto, hero, envío, WhatsApp, Pixel, Clarity, favicon/logo). Para multi-tenant real, debería sumar:
- `domain` (o vivir en una tabla `stores` separada — ver nota de diseño abajo).
- `template` (el selector de plantilla, §4).
- La región/comuna de despacho (hoy hardcodeada en `CheckoutClient.tsx`, no en BD — sería el ejemplo perfecto de algo que hoy es código y debería pasar a configuración: lista de regiones/comunas habilitadas por tienda).
- `order_number_offset` — ya está ahí, ya pensado para ser por tienda (aunque hoy solo hay una fila).
- Nota de diseño: dado que `store_settings` hoy se lee con `.limit(1)` sin filtro, **hay dos caminos**: (a) agregar `store_id` a `store_settings` y que pase a tener una fila por tienda, o (b) crear una tabla `stores` separada con lo estructural (domain, template, plan) y dejar `store_settings` como la tabla 1:1 de "tema" referenciando `stores.id`. Recomiendo (b): separa claramente "identidad de tienda" (pocas veces cambia, referenciada por FK desde todo) de "configuración de tema" (cambia seguido desde el admin).

---

## 6. Aislamiento de datos

Riesgo de fuga entre tiendas hoy: **no aplica todavía porque no hay más de una tienda**, pero el diseño actual maximiza el riesgo futuro: **el 100% del tráfico real de la app pasa por `service_role`**, que bypassa RLS. Es decir, la única barrera contra "la tienda A ve pedidos de la tienda B" sería el filtro `store_id` escrito a mano en cada una de esas ~41 consultas — **no hay red de seguridad de base de datos hoy**, porque RLS no es la barrera que usa la app.

Esto hace que **RLS por `store_id` como red de seguridad adicional sea más importante en este proyecto que en uno típico**, no menos: si el equipo se olvida un `.eq("store_id", ...)` en alguno de los 41 archivos (altamente probable dado el volumen), hoy no hay nada que lo detenga — Postgres serviría la fila igual porque la política actual es "si sos `service_role`, todo pasa".

Camino recomendado: introducir un **cliente Supabase no-service-role para lecturas de tienda** con RLS activo por `store_id` (usando, por ejemplo, un JWT custom con claim `store_id`, o `SET app.store_id` por sesión + políticas `USING (store_id = current_setting('app.store_id')::uuid)`), reservando `service_role` únicamente para el puñado de operaciones verdaderamente cross-tienda (cron jobs, migraciones, superadmin). Esto es un cambio de arquitectura no trivial (hoy todo es `service_role` por conveniencia), pero es la diferencia entre "confiamos en que nadie se olvide un filtro" y "Postgres lo garantiza".

---

## 7. Migración de los datos actuales

Con la base de producción viva (pedidos reales de PonkyBonk), el backfill es mecánicamente simple pero debe hacerse en un orden estricto:

1. Crear tabla `stores`, insertar una fila para PonkyBonk con su dominio actual.
2. Agregar `store_id UUID NULL REFERENCES stores(id)` a cada tabla de §2(a), **nullable primero** (no romper inserts en vuelo durante el deploy).
3. Backfill: `UPDATE products/orders/reviews/clientes/... SET store_id = '<uuid-ponkybonk>' WHERE store_id IS NULL` — trivial porque hoy el 100% de las filas son de PonkyBonk.
4. Recién ahí, `ALTER COLUMN store_id SET NOT NULL` + índice (`CREATE INDEX ... ON orders(store_id)`, etc.) — este paso sí requiere una ventana sin escritura o un `NOT VALID` + `VALIDATE CONSTRAINT` para no bloquear la tabla `orders` en producción mientras tiene tráfico.
5. Recién después de eso, tocar el código para empezar a filtrar/insertar con `store_id`, nunca antes (si el código empieza a exigir `store_id` antes de que el backfill termine, cualquier deploy a medio camino rompe producción).
6. `store_settings`: decidir si se bifurca en `stores` + `store_settings` (recomendado, §5) antes de mover filas, para no tener que rehacer el backfill dos veces.

Nada de esto es riesgoso *si se hace en ese orden* contra una base de desarrollo separada primero (tal como pediste en el plan de fases). El riesgo real es hacerlo contra producción sin practicarlo antes, o saltarse el paso 2 (columna nullable) por apuro.

---

## 8. Veredicto

### Complejidad: **ALTA**

Razón concreta, apoyada en §1, §3 y §4:
- **§1**: no hay capa de datos centralizada → el trabajo se paga archivo por archivo (~41 puntos de acceso directo a Supabase), no en un único lugar.
- **§3**: cero groundwork — ni una columna, ni un flag, ni una mención de "tienda" en todo el repo. Todo lo que hoy funciona, funciona porque asume una sola fila/una sola tienda de forma implícita en decenas de puntos.
- **§4**: cero abstracción de plantillas — Home y el layout raíz están escritos como una página fija, no como una composición de bloques (a diferencia de la ficha de producto, que ya tiene ese patrón con `product_sections` y podría servir de modelo).

Lo que **baja** la complejidad de "alta" a "no extrema": el webhook de Flow, el RPC de stock y el matching de `display_code` **ya son seguros para multi-tenant sin cambios de diseño** (§5) — ese es, normalmente, el punto más peligroso de estos proyectos, y acá ya está bien resuelto por accidente de buen diseño previo.

### Plan por fases (en una rama, contra una BD de desarrollo separada, sin tocar producción hasta el final)

**Fase 0 — Higiene previa (bajo riesgo, se puede hacer ya, incluso antes de decidir el resto):**
- Confirmar en el dashboard de Supabase el estado real de `clientes` y `product_variants` (RLS, y capturar su `CREATE TABLE` real en una migración nueva para que el repo deje de estar incompleto).
- Decidir qué hacer con la tabla `customers` huérfana (dropearla o documentarla como deprecated).

**Fase 1 — Modelo de datos (contra BD de desarrollo):**
- Tabla `stores` (domain, slug, template, activo) + decisión sobre `store_settings` (bifurcar o extender).
- `store_id` nullable en todas las tablas de §2(a) + backfill + luego `NOT NULL` + índices (§7).
- RLS por `store_id` como red de seguridad (§6), aunque el código todavía use `service_role` en esta fase — se activa la política, no se depende de ella todavía.

**Fase 2 — Resolución por dominio + propagación:**
- Middleware resuelve host → `store_id`, lo propaga por header.
- `getStoreSettings()` (y su equivalente para `stores`) reciben `storeId`.

**Fase 3 — Filtrado sistemático (el trabajo de mayor volumen):**
- Recorrer los ~41 archivos, agregar `store_id` a cada `SELECT`/`INSERT`/`UPDATE`. Este es el momento de, si se quiere, introducir por fin una capa de repositorio delgada (no es obligatorio, pero es la oportunidad natural de dejar de tener 41 puntos sueltos).
- Admin: scoping de dashboard/pedidos/productos/reseñas + decisión de modelo de acceso multi-tienda para `admin_users` (§5, pregunta abierta).

**Fase 4 — Capa de plantillas:**
- Registro de plantillas + campo `template` en `stores`.
- Refactor de Home y layout raíz a al menos 2 plantillas reales (no solo 1 + placeholder), para validar que la abstracción realmente generaliza antes de dar por cerrado el sistema.
- Migrar el copy hardcodeado de nicho (los 12 archivos de §3) a datos o a plantilla, según corresponda.

**Fase 5 — Piezas compartidas y bordes sueltos:**
- Región/comuna de despacho: pasar de hardcode a configuración por tienda (`CheckoutClient.tsx`), incluyendo validación server-side (hoy no existe, §3).
- Storage: prefijar rutas de `store-assets`/`products` por `store_id`.
- Cron (`cancel-stale-orders`): adaptar a multi-tienda (iterar o generalizar).
- `display_code`/`order_number_offset`: decidir global vs. por tienda (§5) — este es más una decisión de producto que técnica, se puede dejar para el final sin bloquear nada más.

**Fase 6 — Corte a producción:**
- Recién acá se aplica el backfill (Fase 1, pasos 2-4) contra la BD real, con la tabla `stores` ya conteniendo una fila para PonkyBonk con su dominio actual, de forma que el corte sea invisible para el usuario final.

### Las 3 a 5 cosas más riesgosas

1. **Olvidar un `store_id` en alguno de los ~41 puntos de acceso** (§1, §6) — sin RLS activo como red de seguridad, esto se traduce directo en fuga de datos entre tiendas, silenciosa (no rompe nada, solo muestra datos de más).
2. **Migrar `orders` con `ALTER COLUMN ... SET NOT NULL` sin `NOT VALID`/ventana adecuada**, en una tabla con pedidos reales en vuelo — puede bloquear escrituras de producción justo cuando entra un pago real (§7).
3. **Cambiar el criterio de `display_code` (pasar a correlativo por tienda) sin desacoplar primero el webhook para que dependa de `orders.id`** — hoy el webhook matchea por `display_code`; si dos tiendas pudieran generar el mismo código en algún esquema mal diseñado, ahí sí habría riesgo real de "pago a la tienda equivocada" (§5).
4. **Sobre-generalizar la capa de plantillas** (más de 2-3 plantillas base sin necesidad de negocio real) — el riesgo no es técnico sino de mantenimiento: cada plantilla adicional es superficie de regresión cada vez que se toca algo "compartido" que en realidad no lo era tanto.
5. **Las dos tablas sin `CREATE TABLE` versionado (`clientes`, `product_variants`)** — cualquier trabajo de RLS/backfill que se planifique sin haber confirmado su estado real en el dashboard corre el riesgo de asumir columnas o políticas que no existen.

### Preguntas abiertas que necesito que respondas antes de empezar

1. **Admin multi-tienda**: ¿un mismo login de admin debe poder cambiar entre varias tiendas dentro de una sesión, o cada tienda tiene su propio set de administradores separado? (§5 — cambia el diseño de `admin_users`).
2. **`display_code`**: ¿te importa que el correlativo de pedidos sea compartido entre todas las tiendas (pedido #4.128 puede ser el primero de una tienda nueva), o es un requisito de negocio que cada tienda empiece en su propio "#1"? (§5 — cambia bastante el diseño del webhook y de la tabla `orders`).
3. **Un solo deployment de Vercel para todas las tiendas, o un deployment por tienda apuntando a la misma BD**: tu pedido dice "un solo backend y una sola base de datos", lo que leo como un solo deployment con resolución por dominio (Fase 2). ¿Confirmas eso, o alguna tienda podría necesitar su propio deployment igual (por ejemplo, por límites de Vercel o por necesitar env vars completamente distintas más allá de lo que `store_settings` puede cubrir)?
4. **`clientes` y `product_variants`**: ¿tienes acceso al dashboard de Supabase para confirmarme su RLS actual, o prefieres que te pase el SQL exacto para consultarlo vos mismo?
5. **Plan/límites por tienda**: ¿existe (o vas a necesitar pronto) algún concepto de "plan" por tienda (ej. features habilitadas/deshabilitadas comercialmente, no solo de diseño)? Si sí, conviene modelarlo en `stores` desde la Fase 1 en vez de agregarlo después.

---

*Archivo generado como entregable de auditoría. No se realizó ningún cambio de código como parte de este análisis.*
