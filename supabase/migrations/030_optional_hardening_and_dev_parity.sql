-- ============================================================
-- 030_optional_hardening_and_dev_parity.sql
-- PRIORIDAD 3 — OPCIONAL. No aplicar sin decisión explícita.
--
-- Dos tipos de cambio mezclados a propósito en un solo archivo aparte,
-- porque ninguno es urgente y ambos son "nice to have":
--   A) Hardening: constraints/índices/triggers que el repo esperaba (grupo
--      "a" latente) pero producción nunca tuvo. No son bugs vivos (el
--      código ya se comporta bien sin ellos), son redes de seguridad de
--      más.
--   B) Paridad dev=prod: alinea columnas de store_settings/
--      cliente_direcciones a los defaults/nullability REALES de
--      producción (no a lo que la migración original pedía), para que una
--      base de desarrollo reconstruida desde cero se comporte exactamente
--      igual que producción ante un INSERT sin todos los campos.
--
-- NO toca buckets/columnas huérfanas (bucket "branding", store_settings.
-- support_email/font_display/free_shipping_from/shipping_cost/
-- estimated_days, tabla customers) — quedan para una decisión de limpieza
-- aparte.
-- ============================================================

-- ── A) Hardening ─────────────────────────────────────────────────────────

-- admin_users: el CHECK de role que la migración 014 esperaba nunca se
-- aplicó en producción. role sí se usa para autorización real
-- (app/api/admin/users/route.ts: solo "owner" gestiona otros admins), así
-- que esto es defensa en profundidad, no un bug activo (nada escribe hoy
-- un role fuera de ese set).
ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('owner', 'admin', 'operator'));

-- admin_users: índice e trigger que 014 esperaba y producción no tiene.
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users (active);

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- cliente_direcciones: trigger que 012 esperaba y producción no tiene.
DROP TRIGGER IF EXISTS trg_cliente_direcciones_updated_at ON public.cliente_direcciones;
CREATE TRIGGER trg_cliente_direcciones_updated_at
  BEFORE UPDATE ON public.cliente_direcciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── B) Paridad dev = producción real (grupo "c" del diff) ──────────────

-- store_settings: estas 8 columnas tenían defaults de hex color en la
-- migración 003/009; producción los tiene sin default hoy (probablemente
-- limpiados a mano — la fila única siempre trae valores explícitos desde
-- el admin, así que el default nunca se usa en la práctica). Se alinean
-- para que dev reconstruido no herede un default que producción no tiene.
ALTER TABLE public.store_settings ALTER COLUMN store_name        DROP DEFAULT;
ALTER TABLE public.store_settings ALTER COLUMN primary_color     DROP DEFAULT;
ALTER TABLE public.store_settings ALTER COLUMN accent_color      DROP DEFAULT;
ALTER TABLE public.store_settings ALTER COLUMN background_color  DROP DEFAULT;
ALTER TABLE public.store_settings ALTER COLUMN surface_color     DROP DEFAULT;
ALTER TABLE public.store_settings ALTER COLUMN text_color        DROP DEFAULT;
ALTER TABLE public.store_settings ALTER COLUMN text_muted_color  DROP DEFAULT;
ALTER TABLE public.store_settings ALTER COLUMN border_color      DROP DEFAULT;

-- theme_preset: la migración 009 lo dejó en 'pets_purple_pink'; producción
-- tiene 'custom' como default real hoy.
ALTER TABLE public.store_settings ALTER COLUMN theme_preset SET DEFAULT 'custom';

-- hero_overlay_mode: la migración 010 lo dejó NOT NULL DEFAULT 'manual';
-- producción lo tiene nullable con default 'gradient'.
ALTER TABLE public.store_settings ALTER COLUMN hero_overlay_mode DROP NOT NULL;
ALTER TABLE public.store_settings ALTER COLUMN hero_overlay_mode SET DEFAULT 'gradient';

-- enable_whatsapp_checkout: la migración 004 lo dejó NOT NULL; producción
-- lo tiene nullable (mantiene el default false).
ALTER TABLE public.store_settings ALTER COLUMN enable_whatsapp_checkout DROP NOT NULL;

-- cliente_direcciones: nombre/region sin default en la migración 012;
-- producción los tiene con default de conveniencia para el form de
-- direcciones ("Casa" / región fija de cobertura).
-- Ojo: el CSV de origen mostró "región de O'Higgins" con problemas de
-- codificación (posible comilla tipográfica en vez de recta) — el valor de
-- abajo usa comilla recta estándar. Confirmá el string exacto contra
-- producción antes de aplicar si te importa la paridad byte a byte.
ALTER TABLE public.cliente_direcciones ALTER COLUMN nombre SET DEFAULT 'Casa';
ALTER TABLE public.cliente_direcciones ALTER COLUMN region SET DEFAULT 'Región de O''Higgins';
