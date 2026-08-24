export function variantLabel(optionValues: unknown): string {
  if (!optionValues || typeof optionValues !== "object") return "";
  return Object.values(optionValues as Record<string, string>)
    .filter(Boolean)
    .join(" / ");
}
