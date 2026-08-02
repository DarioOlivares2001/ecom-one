# Configuración de Cloudflare R2

El código de subida de imágenes (logo, favicon/iconos, banners hero, imágenes de producto y los
scripts de optimización) ya está migrado a Cloudflare R2 y compila correctamente, pero **no
puede subir nada todavía** porque `.env.local` no tiene las credenciales de R2. Este documento
explica paso a paso cómo crear el bucket y un token de acceso, y qué variables agregar.

Todas las rutas de upload (`/api/upload/logo`, `/api/upload/favicon`, `/api/upload/hero`) y las
acciones de admin de productos devuelven un error explícito y controlado (503 / mensaje claro en
el formulario) mientras estas variables falten — no rompen el build ni el resto de la app.

## 1. Crear el bucket

1. Entra al [dashboard de Cloudflare](https://dash.cloudflare.com/) → **R2 Object Storage**.
2. Si es la primera vez que usas R2 en esta cuenta, actívalo (tiene una capa gratuita generosa:
   10 GB de almacenamiento y sin costo de egress).
3. **Create bucket**:
   - Nombre sugerido: `ecom-one` (o el que prefieras — es el valor de `R2_BUCKET_NAME`).
   - Location: Automatic (recomendado) o la región más cercana a tus clientes.
4. Confirma la creación.

## 2. Habilitar acceso público al bucket

Las imágenes de la tienda deben ser accesibles públicamente por URL (igual que antes con
Supabase Storage).

**Opción A — dominio propio (recomendado para producción):**

1. Dentro del bucket → pestaña **Settings** → **Public access** → **Custom Domains** → **Connect Domain**.
2. Ingresa un subdominio que ya esté en tu cuenta de Cloudflare (ej. `cdn.tudominio.cl`).
3. Cloudflare crea el registro DNS automáticamente. Cuando quede activo, tu `R2_PUBLIC_URL` será
   `https://cdn.tudominio.cl`.

**Opción B — subdominio `r2.dev` (rápido, solo para desarrollo/pruebas):**

1. Dentro del bucket → **Settings** → **Public access** → **R2.dev subdomain** → **Allow Access**.
2. Copia la URL que te muestra (algo como `https://pub-xxxxxxxxxxxx.r2.dev`). Esa es tu
   `R2_PUBLIC_URL` temporal.
3. **No uses esta opción como solución definitiva de producción** si vas a configurar un dominio
   propio — migra a la Opción A antes de lanzar la tienda.

## 3. Crear un token de acceso limitado a este bucket

No uses tu API Token global de Cloudflare. Crea uno acotado solo a este bucket:

1. En la vista de **R2 Object Storage** (no dentro del bucket) → **Manage R2 API Tokens** →
   **Create API Token**.
2. Nombre: algo identificable, ej. `ecom-one-app`.
3. Permisos: **Object Read & Write**.
4. **Specify bucket(s)** → selecciona únicamente el bucket creado en el paso 1 (no "Apply to all
   buckets").
5. TTL: sin expiración, o la que defina tu política interna (si expira, tendrás que rotar la
   variable en `.env.local`/Vercel más adelante).
6. Crea el token. Cloudflare te muestra **una sola vez**:
   - `Access Key ID`
   - `Secret Access Key`
   - Un `Account ID` (también visible en la barra lateral derecha del dashboard, sección R2).

Guarda estos tres valores en un gestor de contraseñas — no los pegues en el chat ni en ningún
archivo versionado.

## 4. Variables a agregar en `.env.local`

Agrega estas 5 líneas directamente en tu `.env.local` (nunca las pegues en el chat):

```
R2_ACCOUNT_ID=<Account ID del paso 3>
R2_ACCESS_KEY_ID=<Access Key ID del paso 3>
R2_SECRET_ACCESS_KEY=<Secret Access Key del paso 3>
R2_BUCKET_NAME=<nombre del bucket del paso 1>
R2_PUBLIC_URL=<URL pública del paso 2, sin barra final>
```

`.env.example` ya documenta estas 5 variables con comentarios.

## 5. Verificación

Una vez agregadas las variables:

1. Reinicia el servidor de desarrollo (`npm run dev`) si estaba corriendo — las variables de
   entorno solo se leen al iniciar el proceso.
2. Prueba subir un logo desde `/admin/configuracion` (pestaña Identidad → Logo horizontal).
3. Si funciona, la imagen quedará en `<R2_PUBLIC_URL>/logos/logo-horizontal-<timestamp>.webp` y se
   verá en el preview del admin y en el sitio.
4. Prueba también crear un producto con imágenes desde `/admin/productos/nuevo` — deben subir a
   `<R2_PUBLIC_URL>/products/...`.

Si ves un error `503` o el mensaje "Cloudflare R2 no está configurado todavía", significa que
alguna de las 5 variables sigue faltando o tiene un valor vacío.

## Estructura de carpetas dentro del bucket

```
logos/           logo horizontal y cuadrado (store_settings)
favicons/        favicon 32px, apple-touch-icon 180px, ícono PWA 512px
hero-banners/    banners desktop/mobile del home
products/        imágenes de producto (admin/productos/nuevo y edición)
```

## Cuándo continuar

Después de agregar las 5 variables y confirmar que las subidas funcionan, dímelo y continúo con:
- Fase 7 (retirar por completo las dependencias de Supabase, incluida `@supabase/supabase-js` y
  `@supabase/ssr` del `package.json`).
- Fase 8 en adelante (pruebas, seguridad/rendimiento, checklist de despliegue).

Mientras tanto, el resto de la migración (base de datos, autenticación, todos los módulos de
negocio) ya está completo y no depende de R2.
