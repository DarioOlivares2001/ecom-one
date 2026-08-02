-- Recuperación de contraseña: token único y expiración
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS reset_token TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clientes_reset_token
  ON public.clientes (reset_token)
  WHERE reset_token IS NOT NULL;
