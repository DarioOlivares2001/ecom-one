export const ECOMMERCE_CATEGORIES = [
  "Lo más vendido",
  "Packs ahorro",
  "Arena para gatos",
  "Control de olores",
  "Limpieza y accesorios",
  "Snacks y premios",
] as const;

const LEGACY_TO_NEW_CATEGORY: Record<string, string> = {
  accesorios: "Limpieza y accesorios",
  electrónica: "Control de olores",
  electronica: "Control de olores",
  hogar: "Control de olores",
  otro: "Limpieza y accesorios",
  areneros: "Limpieza y accesorios",
  "alimentación y snacks": "Snacks y premios",
  "alimentacion y snacks": "Snacks y premios",
};

export function normalizeProductCategory(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const key = value.toLowerCase();
  const mapped = LEGACY_TO_NEW_CATEGORY[key];
  return mapped ?? value;
}

export function sortCategoriesForStore(categories: string[]): string[] {
  const ranked = ECOMMERCE_CATEGORIES.filter((cat) => categories.includes(cat));
  const rest = categories
    .filter((cat) => !ECOMMERCE_CATEGORIES.includes(cat as (typeof ECOMMERCE_CATEGORIES)[number]))
    .sort((a, b) => a.localeCompare(b, "es"));
  return [...ranked, ...rest];
}

