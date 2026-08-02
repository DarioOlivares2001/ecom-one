# TheGate - Arquitectura del proyecto

Tienda de ecommerce chilena construida con Next.js 14 App Router, Supabase y Flow Chile como pasarela de pagos.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) |
| Base de datos | Supabase (PostgreSQL + RLS + Storage) |
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
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

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

# Admin
ADMIN_EMAIL=
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
    └── upload/
        └── hero/route.ts              # POST multipart - comprime y sube banner hero a Storage (bucket store-assets)
```

---

## Clientes de Supabase

`lib/supabase/` expone tres clientes:

| Archivo | Función | Cuándo usar |
|---|---|---|
| `client.ts` | `createClient()` - anon key | Componentes cliente de la tienda |
| `server.ts` | `createServerClient()` - anon key + cookies | Server components de la tienda |
| `admin.ts` | `createAdminClient()` - service_role key | Rutas `/admin/*`, APIs que mutan datos sensibles, webhook de Flow, **`getStoreSettings()`** (lectura de `store_settings` en servidor) |

El cliente admin bypasea Row Level Security. Se usa en todas las rutas de `/admin/*` y en `/api/flow/*`, upload de hero, etc.

---

## Base de datos

Las migraciones viven en `supabase/migrations/`. El orden numérico importa al aplicarlas en un proyecto nuevo. El detalle por archivo está en **Catálogo de migraciones** más abajo.

### `products`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `slug` | TEXT UNIQUE | URL del producto |
| `name` | TEXT | |
| `description` | TEXT | HTML generado por CodeMirror |
| `price` | INTEGER | Precio en CLP |
| `compare_at_price` | INTEGER | Precio tachado opcional |
| `stock` | INTEGER | |
| `images` | TEXT[] | URLs de Supabase Storage bucket "products" |
| `category` | TEXT | |
| `tags` | TEXT[] | |
| `variants` | JSONB | Opciones del producto (color, talla, etc.) |
| `meta_title` | TEXT | SEO |
| `meta_desc` | TEXT | SEO |
| `active` | BOOLEAN | RLS: solo productos activos son visibles anónimamente |

RLS: lectura pública (`active = true`), escritura solo `service_role`.

### `orders`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `order_number` | SERIAL UNIQUE | Número legible (#1, #2...) |
| `status` | TEXT CHECK | `pending`, `paid`, `preparing`, `shipped`, `delivered`, `cancelled` |
| `customer_name` | TEXT | |
| `customer_email` | TEXT | |
| `customer_phone` | TEXT | |
| `shipping_address` | JSONB | `{direccion, ciudad, region}` |
| `items` | JSONB | Array de `{name, price, quantity, image, variant}` |
| `subtotal` | INTEGER | CLP |
| `shipping_cost` | INTEGER | CLP |
| `total` | INTEGER | CLP |
| `flow_token` | TEXT | Token de sesión Flow |
| `flow_order` | TEXT | ID de orden en Flow |
| `notes` | TEXT | |

RLS: inserción anónima permitida, lectura/actualización solo `service_role`.

El estado `preparing` en el `CHECK` de `orders.status` lo añade la migración `002` (ver catálogo).

### `reviews`

Tabla creada en `001` con: `id`, `product_id`, `order_id`, `author_name`, `rating`, `comment`, `verified`, `active`, `created_at`. La migración `005` añade moderación y contacto/media: `status` (`pending` \| `approved` \| `rejected`), `author_email`, `photo_url`, `updated_at`, y hace backfill de `status` desde `active`.

Vinculada a `products` (CASCADE) y `orders`. Lectura pública de filas aprobadas según políticas; inserción pública; actualización/borrado vía `service_role` y panel `/admin/resenas`.

### `customers`

Solo `service_role`. Agrega totales de pedidos y direcciones guardadas.

### `store_settings`

Fila única (o la más reciente) consumida por `getStoreSettings()`. La app y `lib/supabase/types.ts` esperan también **`hero_overlay_opacity`** (entero, modo manual del hero); **no hay migración en este repo que cree esa columna** — si en tu instancia no existe, añádela con el SQL dashboard o una migración nueva (`INTEGER` / `SMALLINT`, coherente con el admin).

RLS: política `store_settings_service_all` (solo `service_role`). La tienda lee en servidor con admin client.

Banners hero: subida desde admin → `POST /api/upload/hero` → bucket **`store-assets`** (prefijo `hero-banners/`), compresión en `lib/images/compressHeroImage.ts`.

### Catálogo de migraciones SQL

| Archivo | Tabla / recurso | Qué hace |
|---|---|---|
| **`001_initial_schema.sql`** | `products` | PK, slug, precios, stock, `images[]`, categoría, tags, variants JSONB, meta SEO, `active`, timestamps; índices; RLS (lectura pública si `active`, mutación `service_role`). |
| | `orders` | PK, `order_number` SERIAL, `status` con CHECK inicial (`pending`, `paid`, `shipped`, `delivered`, `cancelled`), cliente, `shipping_address` JSONB, `items` JSONB, totales, `flow_token`, `flow_order`, `notes`, timestamps; índices; RLS (insert/update anónimo acotado + `service_role`). |
| | `reviews` | PK, `product_id` FK CASCADE, `order_id` FK, autor, rating 1–5, `comment`, `verified`, `active`, `created_at`; RLS. |
| | `customers` | PK, `email` UNIQUE, nombre, teléfono, `addresses` JSONB[], `total_orders`, `total_spent`, `created_at`; RLS solo `service_role`. |
| | Función | `set_updated_at()` + triggers `BEFORE UPDATE` en `products` y `orders`. |
| **`002_update_orders_status_check.sql`** | `orders` | Sustituye el CHECK de `status` por: `pending`, `paid`, **`preparing`**, `shipped`, `delivered`, `cancelled`. |
| **`003_store_settings_extended.sql`** | `store_settings` | `CREATE TABLE IF NOT EXISTS` con: `id`, `store_name`, `store_tagline`, `logo_url`, `logo_square_url`, `primary_color`, `accent_color`, `background_color`, `surface_color`, `text_color`, `text_muted_color`, `border_color`, `support_whatsapp`, `support_instagram`, `support_tiktok`, `support_email`, **`font_display`**, **`font_body`**, `free_shipping_from`, `shipping_cost`, `estimated_days`, `created_at`, `updated_at`. Trigger `trg_store_settings_updated_at`; RLS + política `store_settings_service_all`. Bloque idempotente: asegura columnas `support_email`, `font_display`, `font_body`, `free_shipping_from`, `shipping_cost`, `estimated_days` si faltaban. |
| **`004_enable_whatsapp_checkout.sql`** | `store_settings` | Columna **`enable_whatsapp_checkout`** `BOOLEAN NOT NULL DEFAULT false`. |
| **`005_reviews_moderation_and_media.sql`** | `reviews` | Columnas **`status`** (`pending` \| `approved` \| `rejected`), **`author_email`**, **`photo_url`**, **`updated_at`**; `UPDATE` de backfill `status` desde `active`. |
| **`006_store_settings_contact_email.sql`** | `store_settings` | Columna **`contact_email`** `TEXT`. |
| **`007_store_settings_hero_banners.sql`** | `store_settings` | Columnas **`hero_banner_desktop_url`**, **`hero_banner_mobile_url`** `TEXT`. |
| **`008_store_assets_bucket.sql`** | `storage.buckets` | Inserta bucket **`store-assets`** (público). Política **`store_assets_public_read`** en `storage.objects` para `SELECT` cuando `bucket_id = 'store-assets'`. |
| **`009_store_settings_admin_config_columns.sql`** | `store_settings` | Añade de forma idempotente todas las columnas que usa el admin de configuración si no existen: `store_name`, `store_tagline`, `logo_url`, `logo_square_url`, `favicon_url`, `brand_text_color`, `navbar_background_color`, `navbar_text_color`, `footer_background_color`, `footer_text_color`, `theme_preset`, `branding_mode`, `logo_size_desktop`, `logo_size_mobile`, `brand_text_scale`, `navbar_brand_position`, `navbar_menu_position`, **`font_heading`**, **`font_body`**, `theme_manual_override`, `primary_color`, `accent_color`, `background_color`, `surface_color`, `text_color`, `text_muted_color`, `border_color`, `support_whatsapp`, `contact_email`, `support_instagram`, `support_tiktok`, `enable_whatsapp_checkout`, `hero_banner_desktop_url`, `hero_banner_mobile_url`. |
| **`010_store_settings_hero_overlay_mode.sql`** | `store_settings` | Columna **`hero_overlay_mode`** `TEXT NOT NULL DEFAULT 'manual'` (la app usa valores `manual` / `auto`). |

**Nota sobre fuentes en BD:** coexisten `font_display` (003) y `font_heading` (009). La vista TypeScript y `getStoreSettings()` usan **`font_heading`** y **`font_body`** al leer la fila.

---

## Flujo de pago - Flow Chile

### Modo mock (FLOW_MOCK=true)

1. El checkout llama `POST /api/flow/create` con los datos del carrito.
2. La ruta crea directamente un registro en `orders` con `status = 'paid'` usando el admin client.
3. Devuelve `{ redirectUrl: /checkout/confirmacion?order=N&token=MOCK-N&mock=1 }`.
4. La página de confirmación muestra el número de orden real.

### Modo real

1. `POST /api/flow/create`:
   - Inserta orden en Supabase con `status = 'pending'`.
   - Firma los parámetros con HMAC-SHA256.
   - Llama a `flow.cl/api/payment/create`.
   - Actualiza la orden con el `flow_token` recibido.
   - Devuelve la URL de redirección a Flow.
2. El usuario paga en la plataforma de Flow.
3. Flow llama a `POST /api/flow/webhook`:
   - Verifica la firma.
   - Si `flowStatus == 2` (pagado), actualiza `orders.status = 'paid'` con admin client.
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
- Crear nuevo: formulario con nombre, precio, stock, categoría, descripción (CodeMirror HTML), imágenes (upload a Supabase Storage).
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
| `lib/utils/mock-products.ts` | Datos de ejemplo para desarrollo sin Supabase |
| `lib/store-settings/getStoreSettings.ts` | Lee y normaliza `store_settings` → `StoreSettingsView` (defaults si falla la DB) |
| `lib/pixel/events.ts` | Helpers para disparar eventos de Meta Pixel |
| `lib/images/compressImage.ts` | Compresión de imágenes de producto (cliente) |
| `lib/images/compressHeroImage.ts` | Compresión de banners hero (API Node) |
| `lib/images/normalizeOptimizedImageUrl.ts` | Normalización de URLs optimizadas |
| `lib/checkout/recommendations.ts` | Lógica de recomendaciones en checkout |
| `lib/product/upsell.ts` | Reglas / fetch de upsells |
| `lib/email/*` | Resend, plantillas de pedido, reseña pendiente, etc. |

Scripts npm útiles: `audit:product-images`, `optimize:product-images`, `fix:product-image-urls`, etc. (ver `package.json`).

---

## Convenciones

- **Server components** para todo lo que puede ser estático (fetch + render).
- **"use client"** solo donde hay interactividad real (estado, eventos, APIs de browser).
- **Server actions** (`"use server"`) para mutaciones: crear/actualizar productos y órdenes.
- `createAdminClient()` (service_role) en rutas admin y API sensibles; nunca en componentes cliente con la service key.
- Los precios se almacenan como enteros en CLP. `formatPrice()` en `lib/utils/format.ts`.
- `normalizeStatus("ready_to_ship")` devuelve `"shipped"` en todos los lugares donde se lee el estado (compatibilidad con nomenclatura antigua de Flow).
- `revalidatePath()` en cada server action que muta datos, apuntando a las rutas afectadas.
