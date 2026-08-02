type OrderItem = {
  name?: string | null;
  quantity?: number | null;
  price?: number | null;
};

type Branding = {
  storeName?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  whatsappNumber?: string | null;
};

type Payload = {
  customerName?: string | null;
  orderNumber?: string | number | null;
  displayCode?: string | null;
  items?: OrderItem[];
  subtotal?: number | null;
  shippingCost?: number | null;
  total?: number | null;
  phone?: string | null;
  shippingAddress?: string | null;
  orderStatus?: string | null;
  branding?: Branding;
};

const BRAND_PRIMARY = "#6D28D9";
const BRAND_ACCENT = "#F472B6";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCLP(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));
}

function statusLabel(statusRaw?: string | null) {
  const raw = String(statusRaw ?? "").toLowerCase().trim();
  if (raw.startsWith("paid")) return "Pago recibido";
  if (raw.startsWith("pending")) return "Pago pendiente";
  if (raw.startsWith("cancelled")) return "Cancelado";
  return raw ? escapeHtml(raw) : "Pago pendiente";
}

function normalizeDigits(raw?: string | null) {
  return String(raw ?? "").replace(/\D/g, "");
}

export function getOrderCustomerHtml(payload: Payload) {
  const storeName = escapeHtml(payload.branding?.storeName || "PonkyBonk");
  const logoUrl = String(payload.branding?.logoUrl ?? "").trim();
  const contactEmail = escapeHtml(payload.branding?.contactEmail || "");
  const contactLine = contactEmail ? `<div>Contacto: ${contactEmail}</div>` : "";
  const instagramUrl = String(payload.branding?.instagramUrl ?? "").trim();
  const tiktokUrl = String(payload.branding?.tiktokUrl ?? "").trim();
  const waDigits = normalizeDigits(payload.branding?.whatsappNumber);
  const waText = encodeURIComponent(
    `Hola, tengo un pedido ${payload.displayCode ?? payload.orderNumber ?? ""} y necesito ayuda.`
  );
  const waLink = waDigits ? `https://wa.me/${waDigits}?text=${waText}` : "";
  const readableStatus = statusLabel(payload.orderStatus);

  const itemsRows = (payload.items ?? [])
    .map((item) => {
      const name = escapeHtml(item.name || "Producto");
      const qty = Number.isFinite(item.quantity) ? Number(item.quantity) : 1;
      const price = Number.isFinite(item.price) ? Number(item.price) : 0;
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${name}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(formatCLP(price))}</td>
      </tr>`;
    })
    .join("");

  const ctaButton = waLink
    ? `<a href="${escapeHtml(waLink)}" style="display:inline-block;background:${BRAND_PRIMARY};color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Hablar por WhatsApp</a>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f3ff;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:20px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:20px;background:linear-gradient(90deg, ${BRAND_PRIMARY}, ${BRAND_ACCENT});color:#fff;">
                ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${storeName}" style="max-height:40px;display:block;margin-bottom:10px;" />` : ""}
                <div style="font-size:22px;font-weight:800;">${storeName}</div>
                <div style="font-size:14px;opacity:0.95;">¡Recibimos tu pedido! 🐾</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px;">
                <p style="margin:0 0 10px;">Hola <strong>${escapeHtml(payload.customerName || "cliente")}</strong>,</p>
                <p style="margin:0 0 14px;">Tu pedido <strong>${escapeHtml(payload.displayCode || String(payload.orderNumber ?? "-"))}</strong> fue recibido correctamente.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:8px 0;border-bottom:1px solid #ddd;">Producto</th>
                      <th align="center" style="padding:8px 0;border-bottom:1px solid #ddd;">Cant.</th>
                      <th align="right" style="padding:8px 0;border-bottom:1px solid #ddd;">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsRows || `<tr><td colspan="3" style="padding:10px 0;">Sin productos</td></tr>`}
                  </tbody>
                </table>
                <div style="margin-top:14px;font-size:14px;">
                  <div style="display:flex;justify-content:space-between;margin:0 0 6px;"><span>Subtotal</span><strong>${escapeHtml(formatCLP(Number(payload.subtotal ?? 0)))}</strong></div>
                  <div style="display:flex;justify-content:space-between;margin:0 0 6px;"><span>Envío</span><strong>${escapeHtml(formatCLP(Number(payload.shippingCost ?? 0)))}</strong></div>
                  <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:20px;color:${BRAND_PRIMARY};">
                    <span style="font-weight:800;">Total</span>
                    <strong>${escapeHtml(formatCLP(Number(payload.total ?? 0)))}</strong>
                  </div>
                </div>
                <div style="margin-top:14px;padding:12px;background:#faf5ff;border:1px solid #eee;border-radius:10px;font-size:14px;">
                  <div><strong>Dirección de despacho:</strong> ${escapeHtml(payload.shippingAddress || "No informada")}</div>
                  <div><strong>Teléfono:</strong> ${escapeHtml(payload.phone || "-")}</div>
                  <div><strong>Estado inicial:</strong> ${readableStatus}</div>
                </div>
                <p style="margin:16px 0 12px;font-size:14px;">Te avisaremos cuando tu pedido avance.</p>
                ${ctaButton}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;background:#fafafa;font-size:12px;color:#6b7280;">
                ${contactLine}
                <div style="margin-top:6px;">
                  ${instagramUrl ? `<a href="${escapeHtml(instagramUrl)}" style="color:${BRAND_PRIMARY};text-decoration:none;margin-right:10px;">Instagram</a>` : ""}
                  ${tiktokUrl ? `<a href="${escapeHtml(tiktokUrl)}" style="color:${BRAND_PRIMARY};text-decoration:none;">TikTok</a>` : ""}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

