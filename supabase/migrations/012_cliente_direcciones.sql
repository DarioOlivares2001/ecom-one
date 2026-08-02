-- Direcciones guardadas por cliente (cuenta)
CREATE TABLE IF NOT EXISTS public.cliente_direcciones (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   UUID        NOT NULL REFERENCES public.clientes (id) ON DELETE CASCADE,
  nombre       TEXT        NOT NULL,
  direccion    TEXT        NOT NULL,
  comuna       TEXT        NOT NULL,
  region       TEXT        NOT NULL,
  referencia   TEXT,
  telefono     TEXT,
  is_default   BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cliente_direcciones_cliente_id
  ON public.cliente_direcciones (cliente_id);

CREATE TRIGGER trg_cliente_direcciones_updated_at
  BEFORE UPDATE ON public.cliente_direcciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.cliente_direcciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente_direcciones_service_all"
  ON public.cliente_direcciones FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
