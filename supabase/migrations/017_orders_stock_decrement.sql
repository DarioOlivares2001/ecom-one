-- ============================================================
-- 017_orders_stock_decrement.sql
-- Descuento atómico de stock al confirmarse el pago de una orden.
-- ============================================================

-- ── Columna idempotencia ─────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_discounted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.stock_discounted IS
  'true cuando la orden ya descontó stock al confirmarse pago (idempotente).';

CREATE INDEX IF NOT EXISTS idx_orders_stock_discounted
  ON public.orders (stock_discounted);


-- ============================================================
-- FUNCTION: confirm_paid_order_and_decrement_stock
--   Bloquea la orden, valida estado, descuenta stock por producto
--   o variante según el item, y marca stock_discounted = true.
--   Si status era 'pending', lo pasa a 'paid'.
--   Idempotente: si la orden ya descontó stock, no vuelve a hacerlo.
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_paid_order_and_decrement_stock(
  p_order_id uuid
)
RETURNS TABLE (
  order_id uuid,
  already_discounted boolean,
  decremented_lines int,
  final_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order        public.orders%ROWTYPE;
  v_item         jsonb;
  v_product_id   uuid;
  v_variant_id   uuid;
  v_quantity     int;
  v_current      int;
  v_lines        int := 0;
BEGIN
  -- Bloquear la fila de la orden para evitar carreras (webhook duplicado, mock + manual).
  SELECT * INTO v_order
    FROM public.orders
   WHERE id = p_order_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Orden % está cancelada; no se descuenta stock', p_order_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Salida temprana si ya descontó stock.
  IF v_order.stock_discounted = true THEN
    RETURN QUERY SELECT v_order.id, true, 0, v_order.status;
    RETURN;
  END IF;

  -- Recorrer items y descontar (producto o variante).
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb))
  LOOP
    v_product_id := (NULLIF(v_item->>'product_id', ''))::uuid;
    v_variant_id := (NULLIF(v_item->>'variant_id', ''))::uuid;
    v_quantity   := COALESCE((v_item->>'quantity')::int, 0);

    IF v_product_id IS NULL OR v_quantity <= 0 THEN
      CONTINUE;
    END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT stock INTO v_current
        FROM public.product_variants
       WHERE id = v_variant_id
         FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variante % no existe', v_variant_id
          USING ERRCODE = 'no_data_found';
      END IF;

      IF v_current < v_quantity THEN
        RAISE EXCEPTION
          'Stock insuficiente para variante % (actual=%, requerido=%)',
          v_variant_id, v_current, v_quantity
          USING ERRCODE = 'check_violation';
      END IF;

      UPDATE public.product_variants
         SET stock = stock - v_quantity
       WHERE id = v_variant_id;
    ELSE
      SELECT stock INTO v_current
        FROM public.products
       WHERE id = v_product_id
         FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no existe', v_product_id
          USING ERRCODE = 'no_data_found';
      END IF;

      IF v_current < v_quantity THEN
        RAISE EXCEPTION
          'Stock insuficiente para producto % (actual=%, requerido=%)',
          v_product_id, v_current, v_quantity
          USING ERRCODE = 'check_violation';
      END IF;

      UPDATE public.products
         SET stock = stock - v_quantity
       WHERE id = v_product_id;
    END IF;

    v_lines := v_lines + 1;
  END LOOP;

  -- Marcar descontado y, si la orden estaba pending, pasarla a paid.
  UPDATE public.orders
     SET stock_discounted = true,
         status = CASE WHEN status = 'pending' THEN 'paid' ELSE status END
   WHERE id = p_order_id
   RETURNING status INTO v_order.status;

  RETURN QUERY SELECT p_order_id, false, v_lines, v_order.status;
END;
$$;

COMMENT ON FUNCTION public.confirm_paid_order_and_decrement_stock(uuid) IS
  'Idempotente. Bloquea orden, descuenta stock (producto o variante) por cada item del JSON, marca stock_discounted=true y pasa status pending→paid.';

REVOKE ALL ON FUNCTION public.confirm_paid_order_and_decrement_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_paid_order_and_decrement_stock(uuid) TO service_role;
