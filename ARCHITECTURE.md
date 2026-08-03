# TheGate - Arquitectura del proyecto

Tienda de ecommerce chilena construida con Next.js 14 App Router, Neon (PostgreSQL serverless) +
Drizzle ORM, Cloudflare R2 para storage de imágenes, y Flow Chile como pasarela de pagos.

> Migrada desde Supabase (PostgreSQL + RLS + Storage) a Neon/Drizzle/R2 con sesiones propias
> (bcrypt + cookie HMAC-SHA256). Ver `MIGRATION_STATUS.md` para el detalle completo de la migración,
> decisiones de diseño y verificaciones realizadas fase por fase.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) |
| Base de datos | Neon (PostgreSQL serverless) + Drizzle ORM (`drizzle-orm/neon-http`) |
| Storage de imágenes | Cloudflare R2 (API compatible con S3, `@aws-sdk/client-s3`) |
| Autenticación | Sesiones propias: `bcryptjs` (hash) + cookie firmada HMAC-SHA256 (sin proveedor externo) |
| Estilos | Tailwind CSS v3 |
| Animaciones | Framer Motion |
| Estado del carrito | Zustand (con persist en localStorage) |
| Validación / esquemas | Zod |
| Gráficos | recharts |
| Editor de descripción | CodeMirror (`@uiw/react-codemirror`, tema vscodeDark) |
| Iconos | lucide-react |
| Pagos | Flow Chile (HMAC-SHA256) |
| Email transaccional | Resend |
| Compresión de imágenes | `browser-image-compression`, `sharp` (API Node) |
| Lenguaje | TypeScript |

---

## Variables de entorno

Archivo de referencia: `.env.example`

```
# Base de datos (Neon, Postgres serverless)
DATABASE_URL=

# Flow Chile
FLOW_API_KEY=
FLOW_SECRET_KEY=
FLOW_API_URL=https://sandbox.flow.cl/api
FLOW_MOCK=true   # fuerza el modo sandbox sin llamar a Flow

# Meta Pixel
NEXT_PUBLIC_META_PIXEL_ID=

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # URL canónica (Flow, emails). En Vercel configurar por entorno.
# SITE_URL=…                                 # opcional; fallback servidor si no hay NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SITE_NAME=TheGate

# Email
RESEND_API_KEY=

# Sesiones propias (bcrypt + cookie HMAC-SHA256). Obligatorias, sin fallback.
ADMIN_SESSION_SECRET=
CUENTA_SESSION_SECRET=

# Cron (protege /api/cron/cancel-stale-orders)
CRON_SECRET=

# Cloudflare R2 (storage de imágenes, API compatible con S3)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

El modo mock de Flow se activa si `FLOW_MOCK=true` o si `FLOW_API_KEY` contiene la cadena "sandbox".

**URL pública (`lib/site-url.ts` → `getPublicSiteUrl`)**  
Orden: `NEXT_PUBLIC_SITE_URL` → `SITE_URL` → `https://VERCEL_URL` → `http://localhost:3000`.  
En **Vercel** conviene definir `NEXT_PUBLIC_SITE_URL` con el dominio canónico de producción (HTTPS, sin barra final). Si falta en un preview, se usa el host del deploy actual (`VERCEL_URL`).  
Tras el pago, el checkout fuerza el origen actual cuando la API devuelve `/checkout/confirmacion` bajo otro host (p. ej. mock con env antiguo); las URLs de **Flow** (`*.flow.cl`) no se reescriben.

---

## Estructura de rutas

```
app/
├── layout.tsx                         # Root layout (fuentes, Toast provider)
├── (store)/                           # Grupo de rutas - tienda pública
│   ├── layout.tsx                     # PromoTickerBar + Navbar + children + Footer + CartDrawer + Toaster (lee store_settings)
│   ├── page.tsx                       # Home: Hero (banners + overlay desde settings), sección problemas, BentoGrid (×2), SocialProof
│   ├── productos/
│   │   ├── page.tsx                   # Catálogo (server) -> ProductsClient
│   │   └── [slug]/
│   │       ├── page.tsx               # Detalle de producto (server)
│   │       └── ProductClient.tsx      # Galería, variantes, add-to-cart, descuentos por volumen, upsells, HTML
│   ├── carrito/page.tsx               # Vista de carrito
│   ├── checkout/
│   │   ├── page.tsx                   # Formulario de checkout + recomendaciones opcionales
│   │   └── confirmacion/page.tsx      # Página de confirmación post-pago
│   ├── seguimiento/page.tsx           # Seguimiento de pedido por email
│   ├── nosotros/page.tsx
│   ├── devoluciones/page.tsx
│   ├── terminos/page.tsx
│   └── politica-privacidad/page.tsx
├── admin/                             # Panel de administración
│   ├── layout.tsx                     # AdminSidebar (desktop fijo + mobile drawer)
│   ├── page.tsx                       # Redirect -> /admin/dashboard
│   ├── dashboard/
│   │   ├── page.tsx                   # Métricas, gráfico ventas, últimos pedidos
│   │   └── SalesChart.tsx             # recharts LineChart (client, ssr:false)
│   ├── pedidos/
│   │   ├── page.tsx                   # Lista de pedidos (server)
│   │   ├── PedidosClient.tsx          # Filtros, búsqueda, tabla (client)
│   │   ├── actions.ts                 # updateOrderStatusAction (server action)
│   │   └── [id]/
│   │       ├── page.tsx               # Detalle de pedido (server)
│   │       └── OrderDetail.tsx        # Gestión de estado, timeline (client)
│   ├── productos/
│   │   ├── page.tsx                   # Lista de productos admin (server)
│   │   ├── nuevo/
│   │   │   ├── page.tsx               # Formulario nuevo producto
│   │   │   └── actions.ts             # createProductAction + updateProductAction
│   │   └── [id]/
│   │       ├── page.tsx               # Página de edición (server)
│   │       └── EditProductoForm.tsx   # Formulario con CodeMirror (client)
│   ├── resenas/
│   │   ├── page.tsx                   # Moderación de reseñas pendientes
│   │   └── ReviewActions.tsx          # Aprobar / rechazar (client)
│   └── configuracion/page.tsx         # Marca, tema, fuentes, hero, WhatsApp checkout, vista previa en vivo
└── api/
    ├── flow/
    │   ├── create/route.ts            # POST - crea pago en Flow (o mock)
    │   └── webhook/route.ts           # POST - confirma pago desde Flow
    ├── pedidos/route.ts               # GET - pedidos por email (seguimiento)
    ├── productos/route.ts             # GET - catálogo público JSON
    ├── reviews/route.ts               # POST - envío de reseña (cliente)
    ├── upsells/route.ts               # GET - productos sugeridos para upsell
    ├── checkout/
    │   ├── recommendations/route.ts   # GET - recomendaciones en checkout
    │   └── whatsapp-config/route.ts   # GET - flag pedido por WhatsApp + teléfono
    └── upload/                        # POST multipart, requieren sesión admin - comprimen y suben a Cloudflare R2
        ├── logo/route.ts              # logo horizontal/cuadrado (prefijo logos/)
        ├── favicon/route.ts           # favicon 32px + apple-touch-icon 180px + ícono PWA 512px (prefijo favicons/)
        └── hero/route.ts              # banner hero desktop/mobile (prefijo hero-banners/)
```

---

## Acceso a datos (Neon + Drizzle)

`lib/db/`:

| Archivo/carpeta | Función |
|---|---|
| `lib/db/client.ts` (o equivalente) | Cliente `drizzle-orm/neon-http` sobre `@neondatabase/serverless`, usando `DATABASE_URL`. HTTP *stateless*: no soporta `db.transaction` interactivo multi-round-trip. |
| `lib/db/schema/*` | Esquema Drizzle modularizado por dominio (`products`, `productVariants`, `orders`, `reviews`, `clientes`, `clienteDirecciones`, `adminUsers`, `storeSettings`), con barrel `index.ts`. |
| `lib/db/types.ts` | Interfaces de fila en **snake_case** (mismo shape que tenía `lib/supabase/types.ts` en la era Supabase), para que el resto del código no tuviera que cambiar cómo lee los campos al migrar. |
| `lib/db/repositories/*` | Funciones tipadas de lectura/escritura por dominio (get/list/create/update); cada una mapea el resultado camelCase de Drizzle al shape snake_case de `types.ts`. Es la única forma en que el resto de la app toca la base de datos — no hay queries SQL sueltas fuera de esta capa (salvo la función nativa de abajo). |
| `lib/db/transactions/confirmPaidOrder.ts` | Wrapper sobre la función PL/pgSQL nativa `confirm_paid_order_and_decrement_stock`. |

No se usa un ORM/cliente admin con bypass de RLS (Neon no tiene RLS configurado): toda ruta que muta datos sensibles debe verificar autenticación explícitamente con `getAdminSessionFromCookies()` (admin) o `getSessionFromCookies()`/equivalente (cuenta de cliente) — ver **Autenticación y sesiones** más abajo.

---

## Base de datos

El esquema vive en `lib/db/schema/*` (Drizzle) y las migraciones aplicadas en `drizzle/*.sql`. El esquema de origen (Supabase) queda documentado como referencia histórica en `supabase/migrations/` — ya no se aplica ni se usa en runtime.

### `products`

Columnas relevantes: `id` (UUID PK), `slug` (UNIQUE), `name`, `description` (HTML de CodeMirror), `price`/`compare_at_price`/`cost_price` (CLP, enteros), `stock`, `images` (TEXT[], URLs de Cloudflare R2), `category`, `tags`, `variants`/`options` (JSONB, para productos con variantes), `has_variants`, `discount_enabled`/`discount_max_percent`/`discount_steps`/`discount_label` (descuento por volumen), `product_sections` (JSONB, bloques modulares de la página de producto), `meta_title`/`meta_desc` (SEO), `active`, `deleted_at` (soft delete).

### `product_variants`

FK a `products` (CASCADE). Columnas: `title`, `option_values` (JSONB), `price`/`compare_at_price`/`cost_price`, `stock`, `image_url`, `badge_text`, `active`, `position`.

### `orders`

`id` (UUID PK), `order_number` (secuencial legible), `display_code` (código público tipo `SO00000001`), `status` (CHECK: `awaiting_payment`, `pending`, `paid`, `preparing`, `shipped`, `delivered`, `cancelled`), datos de cliente, `shipping_address`/`items` (JSONB), `subtotal`/`shipping_cost`/`total`, `flow_token`/`flow_order`, `stock_discounted` (idempotencia), `client_ip_address`/`client_user_agent` (para Meta CAPI).

### `reviews`

FK a `products` (CASCADE) y `orders`. `status` (`pending`/`approved`/`rejected`), `author_name`/`author_email`, `rating`, `comment`, `photo_url`, `active`.

### `clientes` + `cliente_direcciones`

Cuentas de cliente con login propio: `password_hash` (bcrypt), `rut_numero`/`rut_dv`, `reset_token` (recuperación de contraseña, un solo uso). `cliente_direcciones` tiene FK CASCADE a `clientes` y un índice único parcial para la dirección default.

### `admin_users`

Usuarios del panel admin: `email`, `password_hash`, `role` (`owner`/`admin`/`operator`), `active`, `last_login_at`.

### `store_settings`

Fila única (índice singleton `uq_store_settings_singleton`). Incluye identidad de marca, tema/colores, tipografía, banners hero, contacto, `enable_whatsapp_checkout`, Meta Pixel/CAPI (incluido el secreto `meta_capi_access_token`), Microsoft Clarity, envío y numeración de pedidos.

Banners hero, logos, favicons e imágenes de producto: suben vía `/api/upload/{hero,logo,favicon}` o `app/admin/productos/nuevo/actions.ts` → `lib/storage/r2.ts` (Cloudflare R2). Estas rutas y acciones requieren sesión de admin (`getAdminSessionFromCookies()`).

### Función nativa: `confirm_paid_order_and_decrement_stock`

Única función PL/pgSQL del proyecto (portada tal cual desde Supabase). Recorre `orders.items`, descuenta stock de `products`/`product_variants` con `SELECT ... FOR UPDATE` (lock pesimista), es idempotente vía `stock_discounted`, y transiciona `status → paid`. Se invoca vía `db.execute(sql\`select * from confirm_paid_order_and_decrement_stock(${orderId})\`)` — necesario porque el driver HTTP de Neon no soporta transacciones interactivas multi-round-trip, así que la atomicidad se preserva dentro de la función nativa, no en JS.

---

## Autenticación y sesiones

Dos sistemas de sesión independientes, ambos cookie HMAC-SHA256 (`httpOnly`, `secure` en producción, `sameSite: lax`), sin proveedor externo:

| | Admin (`lib/admin/session.ts`) | Cuenta de cliente (`lib/cuenta/session.ts`) |
|---|---|---|
| Secreto | `ADMIN_SESSION_SECRET` (obligatorio, sin fallback) | `CUENTA_SESSION_SECRET` (obligatorio, sin fallback) |
| Duración | 12 h | 30 días |
| Hash de contraseña | `bcryptjs` (cost 12) | `bcryptjs` (cost 12) |
| Verificación de firma | `crypto.timingSafeEqual` | `crypto.timingSafeEqual` |
| Protección de rutas | `app/admin/layout.tsx` redirige a `/admin/login` si no hay sesión | páginas `/cuenta/*` + API routes `/api/cuenta/*` verifican sesión explícitamente |

**Importante para rutas/Server Actions fuera de `app/admin/**` páginas** (API routes en `/api/upload/*`, Server Actions en archivos `actions.ts` o inline `"use server"`): el layout de admin solo protege la *carga de la página*, no protege automáticamente rutas API standalone ni el endpoint interno que invoca una Server Action. Cada una de estas debe llamar explícitamente a `getAdminSessionFromCookies()` y devolver `401`/`{ error: "No autorizado." }` si no hay sesión — patrón ya aplicado en todas las existentes (ver Fase 9 en `MIGRATION_STATUS.md`).

Recuperación de contraseña (ambos: admin vía `/api/admin/users/reset-password`, cliente vía `/api/cuenta/recuperar`+`/api/cuenta/reset`): token de un solo uso con expiración (1 h para cliente). `POST /api/cuenta/recuperar` siempre responde `{ok:true}` exista o no la cuenta, para no filtrar qué emails están registrados.

---

## Flujo de pago - Flow Chile

### Modo mock (FLOW_MOCK=true)

1. El checkout llama `POST /api/flow/create` con los datos del carrito.
2. La ruta crea directamente una orden con `status = 'paid'`.
3. Devuelve `{ redirectUrl: /checkout/confirmacion?order=N&token=MOCK-N&mock=1 }`.
4. La página de confirmación muestra el número de orden real.

### Modo real

1. `POST /api/flow/create`: crea la orden con `status = 'awaiting_payment'`, firma los parámetros con HMAC-SHA256, llama a `flow.cl/api/payment/create`, guarda el `flow_token` recibido y devuelve la URL de redirección a Flow.
2. El usuario paga en la plataforma de Flow.
3. Flow llama a `POST /api/flow/webhook` con un `token`. La ruta **no confía en el body del webhook** — vuelve a consultar `payment/getStatus` directamente a Flow (firmado con el mismo HMAC) para obtener el estado real, y solo entonces, si `status === 2` (pagado), invoca `confirm_paid_order_and_decrement_stock` (idempotente).
4. Flow redirige al usuario a `/checkout/confirmacion`.

### Firma HMAC

Los parámetros se ordenan alfabéticamente, se concatenan como `clave+valor`, y se firman con `crypto.createHmac('sha256', secret)`.

---

## Panel de administración

### Layout

`app/admin/layout.tsx` renderiza `<AdminSidebar>` que recibe `settings` (nombre de tienda + logo). En desktop es un sidebar fijo de 256px; en móvil es un drawer con overlay.

Acceso a `/admin` redirige automáticamente a `/admin/dashboard`.

### Dashboard (`/admin/dashboard`)

- 4 tarjetas de métricas: ventas hoy, ventas este mes, pedidos pendientes, pedidos completados.
- Gráfico de línea (recharts) con ventas de los últimos 7 días, importado dinámicamente con `ssr: false`.
- Tabla de los últimos 5 pedidos con badge de estado.
- Todos los datos vía `Promise.all` sobre el admin client - zero-safe (try/catch devuelve 0 en error).

### Pedidos (`/admin/pedidos`)

- Lista completa con filtros por estado (tabs con conteos en vivo) y búsqueda por número, email o nombre.
- Detalle (`/admin/pedidos/[id]`): `OrderTimeline` visual, botón de acción principal según el estado actual, botón de cancelar, selector de cambio manual.
- `updateOrderStatusAction` (server action): valida contra la lista de estados válidos, actualiza con admin client, revalida las rutas afectadas.

Flujo de estados: `pending -> paid -> preparing -> shipped -> delivered` (o `cancelled` desde cualquier estado previo a `delivered`).

### Productos (`/admin/productos`)

- Lista de todos los productos (incluyendo inactivos) con precio, stock, estado.
- Crear nuevo: formulario con nombre, precio, stock, categoría, descripción (CodeMirror HTML), imágenes (upload a Cloudflare R2).
- Editar existente: misma UI pre-poblada. Las imágenes existentes se mantienen como slots "existing"; se pueden reemplazar con archivos nuevos.
- El formulario envía `slot_count` + `slot_N_type` ("existing" o "new") + `slot_N_url` o `slot_N_file`.

El editor de descripción usa CodeMirror con tema vscodeDark, soporte HTML con resaltado de sintaxis, `lineWrapping` activado, y toggle HTML/Vista previa (componente `QuillEditor` en `components/admin/`).

### Reseñas (`/admin/resenas`)

- Lista de reseñas pendientes de moderación.
- `ReviewActions`: aprobar o rechazar; notificaciones por email cuando corresponde (`lib/email/sendReviewNotification.ts`).

### Configuración (`/admin/configuracion`)

- Identidad: nombre, tagline, logos, favicon, modo de marca (logo / texto / ambos), tamaños de logo.
- Tema: preset, colores (navbar, footer, superficie, texto, primario, acento), posición de marca y menú, **vista previa en vivo** (`ThemeLivePreview.tsx`).
- Fuentes: `FontSelectField` para heading y body (Google Fonts).
- **Hero** (`HeroBannerSection.tsx`): URLs o subida desktop/móvil, modo de overlay (manual con opacidad por pasos, o automático con gradiente fijo).
- Contacto y redes; toggle **pedido por WhatsApp desde el carrito** (`enable_whatsapp_checkout` + número en `support_whatsapp`).

---

## Componentes

### Tienda (`components/store/`)

| Componente | Descripción |
|---|---|
| `Navbar` | Logo / texto según `branding_mode`, navegación, carrito con badge; estilos desde `StoreSettingsView` |
| `PromoTickerBar` | Franja superior de promos (layout tienda) |
| `CartDrawer` | Drawer lateral; opción de enviar pedido por WhatsApp si `enable_whatsapp_checkout` |
| `Hero` | Ver sección siguiente |
| `BentoGrid` | Grid de productos destacados |
| `ProductCard` | Tarjeta de producto con imagen y precio |
| `ProductTieredDiscount` | UI de descuentos por cantidad (detalle / carrito según uso) |
| `CheckoutRecommendations` | Upsell/recomendaciones en checkout (fetch a API) |
| `SocialProof` | Reviews / sección de confianza |
| `SocialProofToast` | Toasts ligados a prueba social |
| `TrustBadges` | Iconos de garantía, envío, etc. |
| `StickerOffers` | Stickers / ofertas en UI de producto |
| `StickyAddToCart` | Barra fija en móvil en la página de producto |
| `Footer` | Links, redes, info legal; colores desde settings |

#### `Hero` (`components/store/Hero.tsx`)

- **Props** (desde `getStoreSettings()` en `app/(store)/page.tsx`): `desktopBannerUrl`, `mobileBannerUrl`, `heroOverlayMode`, `heroOverlayOpacity`; fallback Unsplash si faltan URLs.
- **Fondos**: imagen móvil (`center_bottom`) e imagen desktop (`center_right`), capas separadas.
- **Overlay** (no centrado con el contenido): gradiente **móvil** `180deg` (blanco con alfas decrecientes hacia transparente); **desktop** en modo `auto` gradiente `90deg` fijo; en modo `manual` gradiente `90deg` con mismas paradas y opacidades escaladas por `hero_overlay_opacity` (`buildManualOverlayGradient`).
- **Desktop**: columna izquierda alineada arriba (`md:items-start`, `md:pt-20`, `md:pb-16`); título grande (`text-[52px]`, `max-w-[560px]`); subtítulo y CTAs debajo; chips en grid (sin cambiar textos de botones ni lógica de pago).
- **Móvil**: contenedor `flex flex-col min-h-[780px]` **sin** `justify-center`.
  - **Bloque superior**: `pt-16 text-center` — cápsula (eyebrow), título `text-[34px] leading-[1.05]`, subtítulo acotado en ancho.
  - **Bloque inferior**: `mt-auto mb-10` — empuja **botones** y **stickers** al pie del hero para dejar aire sobre la imagen del producto/gato; links `max-w-[300px]`; lista de stickers con `mt-2`, pills `bg-white/85`.
- **Cápsula**: gradiente morado/rosa (`from-purple-700 to-pink-500`), texto blanco, `shadow-lg`, `ring-white/30`.
- Cliente: Framer Motion `fadeUp`; `useEffect` de debug opcional para URLs de banner.

`ProductClient.tsx` (detalle de producto):

- Galería con fade animado (`AnimatePresence` Framer Motion), swipe táctil (umbral 48px), flechas siempre visibles en móvil y visibles al hover en desktop.
- Thumbnails con borde activo `border-zinc-900`, scrollbar oculto.
- Descuentos por volumen, upsells vía `lib/product/upsell.ts` / API.
- Descripción renderizada como HTML con `dangerouslySetInnerHTML`.

### Admin (`components/admin/`)

| Componente | Descripción |
|---|---|
| `AdminSidebar` | Sidebar desktop fijo + drawer móvil con overlay |
| `OrderTimeline` | Stepper visual del estado del pedido |
| `QuillEditor` | CodeMirror con toggle HTML/Vista previa |

### UI (`components/ui/`)

`Badge`, `Button`, `Input`, `Skeleton`, `Toast` - primitivos reutilizables.

---

## Estado del carrito

`lib/cart/store.ts` - Zustand store con `persist` en `localStorage`.

Items: `{ id, slug, name, price, image, quantity, variant? }`

Operaciones: `add`, `remove`, `update` (quantity), `clear`.

Hidratación SSR: patrón `useState(false)` + `useEffect(() => setMounted(true))` para evitar mismatch entre servidor y cliente.

Utilidades relacionadas: `lib/cart/whatsappCartOrder.ts` (mensaje / enlace para pedido por WhatsApp), `lib/cart/offerUnlockProgress.ts` (progreso de ofertas).

---

## Utilidades

| Módulo | Descripción |
|---|---|
| `lib/utils/format.ts` | `formatPrice()` - Intl.NumberFormat para CLP |
| `lib/utils/mock-products.ts` | Datos de ejemplo para desarrollo/fallback si falla la DB |
| `lib/store-settings/getStoreSettings.ts` | Lee y normaliza `store_settings` → `StoreSettingsView` (defaults si falla la DB) |
| `lib/pixel/events.ts` | Helpers para disparar eventos de Meta Pixel |
| `lib/images/compressImage.ts` | Compresión de imágenes de producto (cliente) |
| `lib/images/compressHeroImage.ts` | Compresión de banners hero (API Node) |
| `lib/images/normalizeOptimizedImageUrl.ts` | Normalización de URLs optimizadas |
| `lib/checkout/recommendations.ts` | Lógica de recomendaciones en checkout |
| `lib/product/upsell.ts` | Reglas / fetch de upsells |
| `lib/email/*` | Resend, plantillas de pedido, reseña pendiente, etc. |
| `lib/storage/r2.ts` | Cliente Cloudflare R2 (`uploadToR2`, `deleteFromR2`, `isR2Configured`), validación de MIME/tamaño |
| `lib/admin/session.ts` / `lib/cuenta/session.ts` | Sesiones propias (cookie HMAC-SHA256), hash bcrypt, `getAdminSessionFromCookies()`/equivalente de cuenta |
| `lib/db/repositories/*` | Capa de acceso a datos (Drizzle + Neon), ver **Acceso a datos** arriba |

Scripts npm útiles: `audit:product-images`, `optimize:product-images`, `fix:product-image-urls`, etc. (ver `package.json`).

---

## Convenciones

- **Server components** para todo lo que puede ser estático (fetch + render).
- **"use client"** solo donde hay interactividad real (estado, eventos, APIs de browser).
- **Server actions** (`"use server"`) para mutaciones: crear/actualizar productos y órdenes.
- Toda ruta API o Server Action que muta datos de admin (`/api/upload/*`, `actions.ts`, `"use server"` inline en páginas de `/admin/**`) empieza verificando `getAdminSessionFromCookies()` y devuelve `401`/`{ error: "No autorizado." }` si no hay sesión — el layout de `/admin` solo protege la carga de la página, no estos endpoints (ver **Autenticación y sesiones**).
- Acceso a datos siempre vía `lib/db/repositories/*` (Drizzle); no hay queries SQL sueltas fuera de esa capa.
- Los precios se almacenan como enteros en CLP. `formatPrice()` en `lib/utils/format.ts`.
- `normalizeStatus("ready_to_ship")` devuelve `"shipped"` en todos los lugares donde se lee el estado (compatibilidad con nomenclatura antigua de Flow).
- `revalidatePath()` en cada server action que muta datos, apuntando a las rutas afectadas.
