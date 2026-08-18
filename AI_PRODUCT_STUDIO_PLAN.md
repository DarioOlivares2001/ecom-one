# Estudio IA de Producto

Estado: **Fase 2 implementada** — `/admin/productos/crear-con-ia` genera borradores reales con OpenAI (Responses API + Structured Outputs). El modo demo local (`generateDemoDraft.ts`) se mantiene en el repo como generador puro/determinista de referencia y para pruebas, pero ya no es lo que usa el asistente — el paso 2→3 del wizard llama a `POST /api/admin/ai-product-studio/generate`, que a su vez llama a `generateAIDraft.ts`.

## 1. Arquitectura

- **`lib/ai-product-studio/schema.ts`** — contrato único de entrada (`aiProductStudioInputSchema`) y salida (`aiProductDraftSchema`), compartido por el generador demo y el real. `productSections` reusa `productSectionsSchema` de `lib/product/sections/types.ts` sin redefinirlo.
- **`lib/ai-product-studio/textFilters.ts`** — filtrado determinístico de líneas ignorables (WhatsApp/contacto, "confirmar stock/inventario", ofertas, despacho de terceros ("entrega en N horas/días"), URLs externas, instrucciones administrativas, garantías ajenas) y detección de encabezados genéricos ("Características destacadas", "Descripción", "Ficha técnica"...). Se aplica **antes** de construir el prompt — el modelo nunca ve ese contenido, no depende de que "se porte bien".
- **`lib/ai-product-studio/slugify.ts`** — mismo algoritmo que el formulario manual, usado para derivar `slug` desde `name` en servidor.
- **`lib/ai-product-studio/specClaims.ts`** — red de seguridad anti-alucinación: si el modelo menciona potencia/medidas/temporizador/enchufe universal/voltaje/certificación/garantía/salud sin que el texto (ya filtrado) del proveedor lo respalde, se elimina del borrador y se deja constancia en `claimsToAvoid`.
- **`lib/ai-product-studio/generateDemoDraft.ts`** — generador local determinista (modo demo), sigue disponible como referencia/fixture de test, ya no está cableado al wizard.
- **`lib/ai-product-studio/generateAIDraft.ts`** — generador real. Server-only. Acepta un cliente OpenAI inyectable (`AIProductStudioOpenAIClient`) para poder testear con un mock sin tocar la red.
- **`lib/ai-product-studio/openaiConfig.ts`** — lee `OPENAI_API_KEY` / `AI_PRODUCT_STUDIO_MODEL` / `AI_PRODUCT_STUDIO_ENABLED` de `process.env`. Solo servidor.
- **`app/api/admin/ai-product-studio/generate/route.ts`** — única puerta de entrada HTTP. Exige sesión admin (`getAdminSessionFromCookies()`), valida el input (tamaño de texto, cantidad de imágenes, tono) y que cada imagen pertenezca al bucket R2 de este proyecto bajo `products/` antes de siquiera considerar llamar a OpenAI.
- **`components/admin/ai-product-studio/AIProductWizard.tsx`** — el asistente de 3 pasos. Sin cambios de flujo respecto a la Fase 1: solo cambió qué endpoint genera el borrador y el aviso ("Generación con IA: revisa todo antes de aplicar y guardar" en vez de "Modo demo").

## 2. Contrato final

### 2.1 Entrada

```ts
{
  supplierText: string;       // hasta 6000 caracteres, texto crudo del proveedor
  commercialGoal?: string;    // "instrucción comercial" opcional del paso 1
  tone: "directo" | "confiable" | "premium" | "practico";
  selectedImages: string[];   // hasta 6 URLs públicas de R2 ya subidas, en orden
}
```

### 2.2 Salida (`AIProductDraft`)

```ts
{
  name: string;                 // "Nombre por confirmar" si no hay evidencia confiable — nunca inventado
  slug: string;                 // SIEMPRE derivado en servidor desde `name` (slugify) — el modelo ni lo propone
  category: string;             // vacío si no hay evidencia suficiente
  tags: string[];
  descriptionHtml: string;      // HTML simple (párrafos)
  productSections: ProductSection[]; // mismo `productSectionsSchema` que ya persiste `products.product_sections`
  galleryImageUrls: string[];   // subconjunto/orden de `selectedImages` — nunca una URL ajena
  detectedFacts: { claim: string; source: "supplier_text" | "image_visual" }[];
  claimsToAvoid: string[];
  fieldsNeedingConfirmation: string[];
  ignoredSupplierLines: string[];
  meta: { mode: "demo" | "ai"; generatedAt: string; model?: string; warnings: string[] };
}
```

`price`, `stock`, `cost_price`, `discount_*`, `dropi_product_url`, `active` y cualquier configuración de tienda quedan **fuera del contrato a propósito** — el Estudio IA no puede tocarlos ni indirectamente, sin importar qué genere el modelo.

### 2.3 Regla imagen + texto

Las imágenes solo respaldan lo **visualmente observable** (color, forma, uso visible, ambiente, composición) — nunca materiales exactos, medidas, potencia, certificaciones ni ninguna especificación técnica, aunque "se vean" de cierta forma. Las especificaciones técnicas solo pueden venir del texto del proveedor. Esto se exige por prompt (regla 2-3 del system prompt) y se refuerza server-side con `specClaims.ts`: cualquier patrón de potencia/medidas/temporizador/enchufe universal/certificación/garantía/salud que el modelo mencione sin que aparezca también en el texto filtrado del proveedor se elimina del borrador antes de devolverlo, nunca se confía solo en que el prompt haya bastado.

### 2.4 Schema exigido al modelo (subconjunto seguro)

El modelo **no** recibe el `productSectionsSchema` completo — solo puede producir bloques `benefits`, `usage`, `measurements` o `versatility` (nunca `faq`, `testimonials`, `before_after`, `media_strip` ni `visual_sequence`: esos requerirían inventar preguntas/respuestas, reseñas de clientes falsas o decidir arbitrariamente qué imagen es "antes"/"después"). Tampoco recibe `id`/`order`/`enabled` de cada bloque (los asigna el servidor) ni `slug` (se deriva siempre en servidor). Los campos de texto opcionales del schema real (`heading`/`description`/`alt`) se piden como strings obligatorios (vacío = sin dato) porque los Structured Outputs estrictos de OpenAI no soportan `.optional()` sin `.nullable()` — `generateAIDraft.ts` convierte el string vacío a campo ausente al ensamblar el `AIProductDraft` final, que sí valida contra el `productSectionsSchema` real.

## 3. Validación del lado del servidor

1. Zod valida el input (`aiProductStudioInputSchema`) y la respuesta cruda del modelo (`aiModelOutputSchema`, el subconjunto seguro de la sección 2.4) — si el modelo devuelve algo fuera de ese schema (ej. un bloque `faq`), se rechaza como `invalid_response` sin intentar repararlo.
2. **Filtro anti-alucinación de imágenes**: cada URL en `galleryImageUrls` y en cada `image_url` de bloque se valida contra `selectedImages` — cualquier URL ajena se descarta (si `galleryImageUrls` queda vacía tras filtrar, cae de vuelta a `selectedImages` completo; nunca se deja una galería vacía).
3. **Filtro anti-alucinación de especificaciones** (`specClaims.ts`, sección 2.3).
4. `slug` se recalcula siempre en servidor desde `name` — cualquier valor que el modelo hubiera intentado sugerir se descarta.
5. Nombre: si `name` (ya corregido) sigue pareciendo un encabezado genérico de sección (misma detección que el modo demo, `looksLikeGenericHeading`), se reemplaza por "Nombre por confirmar" — defensa en profundidad, no confía en que el prompt haya bastado.
6. El `AIProductDraft` ensamblado se revalida una última vez contra `aiProductDraftSchema` completo antes de devolverlo — si por algún motivo no calzara, se responde `invalid_response` en vez de devolver algo a medio validar.
7. La ruta (`app/api/admin/ai-product-studio/generate/route.ts`) es 100% server-side, exige sesión admin, y valida que cada imagen pertenezca al bucket R2 propio antes de construir cualquier request a OpenAI.

## 4. Seguridad

- `OPENAI_API_KEY` solo se lee en `lib/ai-product-studio/openaiConfig.ts` (server-only) y solo se usa para construir el cliente de `generateAIDraft.ts` — nunca se loguea, nunca viaja en una respuesta HTTP, nunca se expone al navegador (sin prefijo `NEXT_PUBLIC_*`).
- `store: false` en toda llamada a OpenAI — no se conserva el request/response del lado de OpenAI.
- `AI_PRODUCT_STUDIO_ENABLED` se chequea antes de cualquier otra cosa — si no es `"true"`, la ruta responde con un error claro (`503`, código `disabled`) sin siquiera construir un cliente de OpenAI.
- Sin `OPENAI_API_KEY` configurada, responde `503` con código `not_configured`.
- Timeout de 45s en el server (`REQUEST_TIMEOUT_MS`) más un timeout de 60s en el cliente (el asistente aborta la espera y muestra un error si el servidor no respondió) — nunca cuelga indefinidamente.
- Errores de la API de OpenAI (`APIError`, `APIConnectionTimeoutError`) se capturan y se traducen a un mensaje genérico para el admin — nunca se filtra el mensaje crudo de OpenAI ni ningún detalle interno.
- El `supplierText` es contenido no confiable (texto pegado de un proveedor externo) — el system prompt lo trata como tal (reglas explícitas, nunca instrucciones que el texto pudiera intentar inyectar) y, más importante, el filtrado determinístico de `textFilters.ts` corre ANTES del prompt, así que ni siquiera depende de que el modelo resista una inyección.

## 5. Límites de costo (parcialmente implementado)

Implementado en esta fase: `supplierText` capado a 6000 caracteres, `selectedImages` capado a 6, timeout de 45s por llamada, sin reintentos automáticos (una respuesta inválida es simplemente un error, no un loop de reintento).

**No implementado todavía** (trabajo futuro, no bloqueante para usar el estudio): rate limiting por admin/día, alerta de presupuesto mensual. Si el volumen de uso lo justifica, agregar un contador simple (tabla `ai_product_studio_usage` o similar) antes de permitir una nueva generación.

## 6. Flujo de aprobación (sin cambios respecto a la Fase 1)

1. Admin pega texto + instrucción comercial opcional + tono (paso 1), sube/ordena imágenes (paso 2) → "Generar con IA".
2. El borrador se muestra en una **vista previa editable** (paso 3): datos detectados del proveedor separados de campos por confirmar/afirmaciones omitidas, con el aviso "Generación con IA: revisa todo antes de aplicar y guardar".
3. Admin edita lo que quiera antes de aplicar.
4. "Aplicar al borrador" navega al formulario manual (`/admin/productos/nuevo`) ya rellenado, vía `sessionStorage` (`lib/ai-product-studio/bridge.ts`) — **no crea ni guarda nada en Neon**. El guardado real sigue pasando exclusivamente por "Guardar producto" (`createProductAction`), con sus mismas validaciones actuales.
5. Ni el prompt ni el código del estudio pueden tocar `price`/`stock`/`cost_price`/`discount_*`/`dropi_product_url`/`active` — quedan fuera del contrato de salida a propósito.
6. Cancelar el asistente antes de aplicar no deja ningún producto ni referencia en Neon; la limpieza best-effort de imágenes ya subidas a R2 sigue el mismo mecanismo de la Fase 1 (ver `AIProductWizard.tsx` y `DELETE /api/upload/product-image`).

## 7. Trabajo futuro fuera de alcance de esta fase

- Rate limiting / presupuesto mensual (sección 5).
- Job de barrido server-side para imágenes huérfanas en R2 si el admin cierra la pestaña sin usar "Cancelar" (ver Fase 1, mecanismo de limpieza ya documentado ahí — sigue sin resolverse el caso de cierre abrupto).
- Edición rica por bloque dentro del asistente (hoy la vista previa es campos planos + incluir/excluir bloque completo).
- Campos de formulario para meta-título/meta-descripción SEO (el contrato de esta fase los excluyó a propósito — no estaban en la lista de salida obligatoria pedida).
- Sugerencia de `category` a partir de un listado real de categorías ya usadas en la tienda (se deja intencionalmente vacía para no adivinar el rubro).
- Aplicar un borrador de IA sobre un producto **existente** (hoy el asistente solo alimenta la creación de productos nuevos).
- Cache de borradores generados (para no volver a pagar la llamada si el admin cierra el asistente sin aplicar y lo reabre con el mismo input).
