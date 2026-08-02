type Branding = {
  storeName?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
};

type Payload = {
  productName?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  rating?: number | null;
  comment?: string | null;
  adminUrl?: string | null;
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

function stars(ratingRaw?: number | null) {
  const rating = Math.max(0, Math.min(5, Math.round(Number(ratingRaw ?? 0))));
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

export function getReviewPendingHtml(payload: Payload) {
  const storeName = escapeHtml(payload.branding?.storeName || "PonkyBonk");
  const logoUrl = String(payload.branding?.logoUrl ?? "").trim();
  const contactEmail = escapeHtml(payload.branding?.contactEmail || "");
  const contactLine = contactEmail ? `<div>Contacto: ${contactEmail}</div>` : "";
  const instagramUrl = String(payload.branding?.instagramUrl ?? "").trim();
  const tiktokUrl = String(payload.branding?.tiktokUrl ?? "").trim();
  const adminUrl = String(payload.adminUrl ?? "").trim();

  const cta = adminUrl
    ? `<a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:${BRAND_PRIMARY};color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Ver en admin</a>`
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
                <div style="font-size:14px;opacity:0.95;">Nueva reseña pendiente</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px;">
                <p style="margin:0 0 10px;"><strong>Producto:</strong> ${escapeHtml(payload.productName || "Sin nombre")}</p>
                <p style="margin:0 0 6px;"><strong>Autor:</strong> ${escapeHtml(payload.authorName || "-")}</p>
                <p style="margin:0 0 10px;"><strong>Email:</strong> ${escapeHtml(payload.authorEmail || "-")}</p>
                <p style="margin:0 0 10px;font-size:18px;color:#b45309;">
                  <strong>${stars(payload.rating)} ${escapeHtml(payload.rating ?? 0)}/5</strong>
                </p>
                <div style="padding:12px;background:#faf5ff;border:1px solid #eee;border-radius:10px;font-size:14px;">
                  <strong>Comentario:</strong>
                  <div style="margin-top:6px;white-space:pre-wrap;">${escapeHtml(payload.comment || "-")}</div>
                </div>
                <div style="margin-top:14px;">${cta}</div>
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

