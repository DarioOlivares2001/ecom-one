-- Reconocimiento del aviso de datos recuperados desde pedidos anteriores (misma cuenta / email).
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS profile_recovery_ack_at TIMESTAMPTZ;

COMMENT ON COLUMN public.clientes.profile_recovery_ack_at IS
  'Marca de tiempo cuando el usuario confirmó el aviso de datos importados desde compras previas sin cuenta.';
