-- Migracion de categorias legacy a categorias comerciales orientadas a conversion.
UPDATE public.products
SET category = CASE lower(trim(category))
  WHEN 'accesorios' THEN 'Limpieza y accesorios'
  WHEN 'electrónica' THEN 'Control de olores'
  WHEN 'electronica' THEN 'Control de olores'
  WHEN 'hogar' THEN 'Control de olores'
  WHEN 'otro' THEN 'Limpieza y accesorios'
  WHEN 'areneros' THEN 'Limpieza y accesorios'
  WHEN 'alimentación y snacks' THEN 'Snacks y premios'
  WHEN 'alimentacion y snacks' THEN 'Snacks y premios'
  ELSE category
END
WHERE category IS NOT NULL;

