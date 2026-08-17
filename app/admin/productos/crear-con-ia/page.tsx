import type { Metadata } from "next";
import { AIProductWizard } from "@/components/admin/ai-product-studio/AIProductWizard";

export const metadata: Metadata = { title: "Crear producto con IA — Admin" };

/**
 * Asistente de pantalla completa (3 pasos: proveedor → imágenes → vista
 * previa) del Estudio IA de Producto. Fase 1 — modo demo, sin proveedor de
 * IA real. Ver AI_PRODUCT_STUDIO_PLAN.md para el diseño de la integración
 * real futura y lib/ai-product-studio/ para el contrato/generador.
 *
 * "Aplicar al borrador" nunca crea ni guarda un producto acá — deja el
 * borrador en sessionStorage (ver lib/ai-product-studio/bridge.ts) y navega
 * a /admin/productos/nuevo, que lo aplica sobre el formulario manual
 * existente. El guardado real sigue pasando solo por ese formulario.
 */
export default function CrearConIAPage() {
  return <AIProductWizard />;
}
