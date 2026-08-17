# Checklist de variables de entorno — Vercel

Este documento lista **todas** las variables de entorno que el proyecto puede usar, de dónde sale
cada valor y si son obligatorias u opcionales para build/producción en Vercel. Se generó revisando
`.env.example`, los nombres de variable presentes en `.env.local` (sin leer sus valores) y cada uso
real de `process.env.*` en el código (`app/**`, `lib/**`, `scripts/**`, `next.config.mjs`,
`drizzle.config.ts`). **No contiene ningún valor real**, solo nombres y descripciones.

Convención de columnas:
- **Build**: si falta, ¿rompe `next build`?
- **Runtime**: si falta, ¿qué pasa al usar la app ya desplegada?

---

## 1. Obligatorias (bloquean build o funcionalidad crítica)

| Variable | Build | Runtime si falta | Origen del valor |
|---|---|---|---|
| `DATABASE_URL` | **Rompe el build.** `lib/db/client.ts` lanza una excepción apenas se importa el módulo si no está definida, y varias páginas se generan estáticamente en build time consultando la base (confirmado: el build hace queries reales a `store_settings`). | La app entera deja de funcionar (todo pasa por Drizzle/Neon). | Connection string de un proyecto **Neon** (Postgres serverless). Se obtiene desde el dashboard de Neon → conexión de la base. Debe ser la base de **producción**, con las migraciones de `drizzle/*.sql` ya aplicadas ahí. |
| `ADMIN_SESSION_SECRET` | No afecta el build (se lee de forma perezosa, solo al crear/verificar una sesión). | El login de `/admin` lanza error al intentar crear la sesión — el panel de administración queda inutilizable. | Secreto generado localmente, no viene de ningún proveedor externo: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Usar un valor **distinto** al de desarrollo. |
| `CUENTA_SESSION_SECRET` | No afecta el build. | El login/registro de clientes (`/cuenta/*`) deja de funcionar. | Igual que arriba, generado localmente. Valor **distinto** al de `ADMIN_SESSION_SECRET` y al de desarrollo. |
| `R2_ACCOUNT_ID` | No afecta el build directamente. | Sin esta variable (y las otras 4 de R2), `isR2Configured()` devuelve `false`: las rutas de upload (`/api/upload/logo`, `/favicon`, `/hero`) y la creación de productos con imágenes devuelven error `503` controlado — no rompen el resto de la app, pero el admin no puede subir ninguna imagen nueva. | Dashboard de Cloudflare → R2 Object Storage → sección "Account ID" (barra lateral). |
| `R2_ACCESS_KEY_ID` | Igual que arriba. | Igual que arriba. | Cloudflare R2 → "Manage R2 API Tokens" → crear un token acotado al bucket del proyecto (no el token global de la cuenta). Se muestra **una sola vez** al crearlo. |
| `R2_SECRET_ACCESS_KEY` | Igual que arriba. | Igual que arriba. | Mismo token que `R2_ACCESS_KEY_ID`, se genera junto con él. Se muestra **una sola vez**. |
| `R2_BUCKET_NAME` | Igual que arriba. | Igual que arriba. | Nombre del bucket creado en Cloudflare R2 (definido por quien lo crea, ej. `ecom-one`). |
| `R2_PUBLIC_URL` | **Si falta durante el build**, `next.config.mjs` omite ese dominio de `images.remotePatterns` (no rompe el build, pero queda "congelado" en esa configuración hasta el próximo build/deploy). | Sin ella, ninguna imagen subida a R2 se puede optimizar con `next/image` (rotas o sin optimizar), además de que las subidas fallan por la misma razón que arriba. **Importante**: si se agrega o cambia esta variable después de un deploy, hace falta un **nuevo build** (no solo reiniciar) para que `next/image` la reconozca. | URL pública del bucket: dominio propio conectado en Cloudflare R2 → Settings → Public Access → Custom Domains (recomendado en producción), o el subdominio `https://pub-xxxx.r2.dev` (solo para desarrollo/pruebas, no usar en producción final — ver `R2_SETUP.md`). |
| `FLOW_API_KEY` | No afecta el build (tiene fallback a cadena vacía). | **Riesgo de negocio, no técnico**: si está vacía o contiene la palabra "sandbox", el checkout entra en modo mock automáticamente (`app/api/flow/create/route.ts`) — las órdenes se marcan `paid` al instante **sin cobrar de verdad**. Confirmar que en producción sea la API key **real** de la cuenta Flow. | Dashboard de Flow Chile (cuenta de comercio en modo producción, no sandbox). |
| `FLOW_SECRET_KEY` | No afecta el build. | Sin ella, la firma HMAC de las peticiones a Flow falla y los pagos reales no se pueden crear/confirmar. | Dashboard de Flow Chile, junto con `FLOW_API_KEY`. |

---

## 2. Opcionales (la app funciona sin ellas, con degradación controlada)

| Variable | Qué pasa si falta | Origen del valor |
|---|---|---|
| `FLOW_API_URL` | Tiene default a `https://sandbox.flow.cl/api` en el código (`app/api/flow/webhook/route.ts`, `app/api/flow/create/route.ts`). En producción **sí conviene definirla explícitamente** con la URL real de la API de Flow (no la de sandbox), aunque técnicamente el build no la exige. | Documentación de Flow Chile (URL de API de producción). |
| `FLOW_MOCK` | Si no está o no es `"true"`, se activa igual el modo mock si `FLOW_API_KEY` contiene "sandbox" (ver arriba). No está en `.env.example` actual pero sí se lee en código. | Se define manualmente; en producción no debería existir o debe ser `false`/omitida. |
| `NEXT_PUBLIC_SITE_URL` | Si falta, se usa `SITE_URL`, y si tampoco existe, `https://VERCEL_URL` (provista automáticamente por Vercel en cada deploy) o `http://localhost:3000` como último fallback (`lib/site-url.ts`). Afecta URLs de retorno de Flow, links en emails y metadata. En producción conviene definirla con el dominio canónico para no depender del host de deploy. | Dominio de producción propio (ej. `https://tudominio.cl`, sin barra final). |
| `SITE_URL` | Alternativa server-only a `NEXT_PUBLIC_SITE_URL` (mismo propósito, no se expone al cliente). Ver orden de fallback arriba. | Igual que `NEXT_PUBLIC_SITE_URL`. |
| `RESEND_API_KEY` | Sin ella (o sin `STORE_FROM_EMAIL`), `lib/email/resend.ts` no lanza error: solo registra un warning en logs y **no envía el correo** (confirmación de pedido, notificación de reseña, recuperación de contraseña por email si aplica). No rompe checkout ni ninguna otra funcionalidad. | Dashboard de Resend (cuenta con dominio de envío verificado, no en modo sandbox). |
| `STORE_FROM_EMAIL` | Ver arriba (va junto con `RESEND_API_KEY`). | Dirección "from" verificada en Resend (debe pertenecer a un dominio verificado ahí). |
| `STORE_CONTACT_EMAIL` | Usado como destinatario del email de notificación interna de nuevo pedido/reseña (`sendOrderNotification.ts`, `sendReviewNotification.ts`). Si falta, ese correo interno no tiene destinatario válido — no afecta el email que recibe el cliente. | Casilla de correo interna de la tienda para recibir notificaciones de pedidos/reseñas. |
| `CRON_SECRET` | Protege `GET /api/cron/cancel-stale-orders` (cancela automáticamente órdenes `awaiting_payment` abandonadas hace más de 60 min). Si falta, la ruta compara contra `Bearer undefined` — nunca autoriza a nadie, así que **falla cerrada** (no es un agujero de seguridad) pero esa red de seguridad simplemente no se ejecuta nunca. No rompe build ni el resto del checkout. | Secreto generado localmente (mismo comando que los de sesión). Debe coincidir con el header `Authorization: Bearer <valor>` que configure el cron job (Vercel Cron u otro programador) al invocar la ruta. |

---

## 3. Provistas automáticamente por la plataforma (no configurar a mano)

| Variable | Notas |
|---|---|
| `VERCEL_URL` | La setea Vercel automáticamente en cada deploy (preview y producción). Se usa como fallback de `NEXT_PUBLIC_SITE_URL`/`SITE_URL` (ver `lib/site-url.ts`). No definir manualmente. |
| `NODE_ENV` | La setea Next.js/Vercel según el contexto (`production` en build de producción). Se lee en varios lugares (`lib/admin/session.ts`, `lib/cuenta/session.ts` para la flag `secure` de las cookies; algunos componentes para logs de debug solo en dev). No definir manualmente en Vercel. |

---

## 4. Presentes en `.env.example` pero **sin ningún uso en el código actual**

Se confirmó con búsqueda exhaustiva de `process.env.*` en todo el repo que estas variables no las
lee ningún archivo `.ts`/`.tsx`/`.mjs`. No hace falta configurarlas en Vercel.

| Variable | Nota |
|---|---|
| `NEXT_PUBLIC_META_PIXEL_ID` | El Meta Pixel ID real se guarda en la base de datos (`store_settings.meta_pixel_id`), configurable desde `/admin/marketing/meta`. Esta variable de entorno quedó vestigial de una versión anterior. |
| `NEXT_PUBLIC_SITE_NAME` | El nombre de la tienda también sale de `store_settings.store_name` (configurable en `/admin/configuracion`), no de esta variable. |
| `ADMIN_EMAIL` | Ya marcada en `.env.example` como "Legacy fallback (temporal)". Confirmado por grep: cero referencias en `.ts`/`.tsx`. Los admins reales se gestionan en la tabla `admin_users` (`/admin/usuarios`, o el script de la sección 5). |
| `ADMIN_PASSWORD` | Igual que `ADMIN_EMAIL` — sin uso real, candidata a eliminar de `.env.example` en una futura limpieza. |

---

## 5. Solo para herramientas locales (no son parte del deploy en Vercel)

| Variable | Uso |
|---|---|
| `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_ROLE` | Leídas únicamente por `scripts/create-admin-user.ts`, un script de un solo uso que se corre localmente (`npx tsx scripts/create-admin-user.ts --email=... --password=...`) para crear el primer usuario admin en una base nueva. Se pueden pasar como argumentos `--email`/`--password`/`--role` en vez de variables de entorno. No agregar a la configuración de Vercel. |

---

## Resumen rápido para copiar/pegar en Vercel → Settings → Environment Variables

Obligatorias (Production, y Preview si se prueba con datos reales):
```
DATABASE_URL
ADMIN_SESSION_SECRET
CUENTA_SESSION_SECRET
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
FLOW_API_KEY
FLOW_SECRET_KEY
```

Recomendadas (funcionalidad se degrada sin ellas, no rompe nada):
```
FLOW_API_URL
NEXT_PUBLIC_SITE_URL
RESEND_API_KEY
STORE_FROM_EMAIL
STORE_CONTACT_EMAIL
CRON_SECRET
```

No usar en Vercel: `NEXT_PUBLIC_META_PIXEL_ID`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (sin uso real),
`ADMIN_SEED_*` (solo scripts locales), `VERCEL_URL`/`NODE_ENV` (las setea la plataforma).
