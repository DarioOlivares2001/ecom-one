import { sendEmail } from "@/lib/email/resend";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendWelcomeEmail(opts: {
  to: string;
  customerName: string;
  storeName: string;
}): Promise<void> {
  const safeName = escapeHtml(opts.customerName.trim() || "Cliente");
  const safeStore = escapeHtml(opts.storeName.trim() || "la tienda");
  const subject = `Tu cuenta en ${opts.storeName.trim() || "la tienda"}`;
  const html = `<!DOCTYPE html>
<html lang="es">
  <body style="font-family:system-ui,sans-serif;line-height:1.5;color:#18181b;">
    <p>Hola ${safeName},</p>
    <p>Tu cuenta en <strong>${safeStore}</strong> ya está activa.</p>
    <p>Podrás acceder a ofertas especiales, repetir compras más rápido y guardar tus datos de envío cuando habilitemos el acceso con contraseña.</p>
    <p style="margin-top:1.5rem;font-size:0.875rem;color:#71717a;">Gracias por confiar en nosotros.</p>
  </body>
</html>`;

  await sendEmail({ to: opts.to, subject, html });
}
