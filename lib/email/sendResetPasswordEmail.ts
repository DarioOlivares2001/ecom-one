import { sendEmail } from "@/lib/email/resend";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendResetPasswordEmail(opts: {
  to: string;
  customerName: string;
  storeName: string;
  resetUrl: string;
}): Promise<void> {
  const safeName = escapeHtml(opts.customerName.trim() || "Cliente");
  const safeStore = escapeHtml(opts.storeName.trim() || "la tienda");
  const safeUrl = escapeHtml(opts.resetUrl.trim());

  const subject = `Restablecer contraseña — ${opts.storeName.trim() || "Tu tienda"}`;
  const html = `<!DOCTYPE html>
<html lang="es">
  <body style="font-family:system-ui,sans-serif;line-height:1.55;color:#18181b;max-width:32rem;">
    <p>Hola ${safeName},</p>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${safeStore}</strong>.</p>
    <p style="margin-top:1.25rem;">
      <a href="${safeUrl}" style="display:inline-block;padding:0.65rem 1.25rem;background:#18181b;color:#fff;text-decoration:none;border-radius:0.5rem;font-weight:600;font-size:0.9375rem;">
        Restablecer contraseña
      </a>
    </p>
    <p style="margin-top:1rem;font-size:0.8125rem;color:#52525b;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
      <span style="word-break:break-all;">${safeUrl}</span>
    </p>
    <p style="margin-top:1.25rem;font-size:0.8125rem;color:#71717a;">
      El enlace caduca en 1 hora. Si no solicitaste este cambio, ignora este mensaje.
    </p>
  </body>
</html>`;

  await sendEmail({ to: opts.to, subject, html });
}
