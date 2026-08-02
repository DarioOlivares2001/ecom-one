export function normalizeOptimizedImageUrl(url: string): string {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  if (!raw.includes("/products/")) return raw;
  if (/-opt\.webp(\?.*)?$/i.test(raw)) return raw;
  if (!/\.(png|jpe?g|webp)(\?.*)?$/i.test(raw)) return raw;

  const [base, query = ""] = raw.split("?");
  const next = base.replace(/\.(png|jpe?g|webp)$/i, "-opt.webp");
  return query ? `${next}?${query}` : next;
}

