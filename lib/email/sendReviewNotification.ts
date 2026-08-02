import { sendEmail } from "@/lib/email/resend";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { getReviewPendingHtml } from "@/lib/email/templates/reviewPending";
import { getPublicSiteUrl } from "@/lib/site-url";

type ReviewNotificationPayload = {
  product: { id: string; name?: string | null };
  author: string;
  authorEmail?: string | null;
  rating: number;
  comment: string;
};

export async function sendReviewNotification(payload: ReviewNotificationPayload) {
  const settings = await getStoreSettings();
  const to = process.env.STORE_CONTACT_EMAIL?.trim();
  if (!to) {
    console.warn("[email-error] STORE_CONTACT_EMAIL no configurado para reseñas.");
    return;
  }
  console.log("[email] to (STORE_CONTACT_EMAIL):", to);

  const subject = `Nueva reseña pendiente - ${payload.product.name ?? payload.product.id}`;
  const html = getReviewPendingHtml({
    productName: payload.product.name ?? payload.product.id,
    authorName: payload.author,
    authorEmail: payload.authorEmail ?? "",
    rating: payload.rating,
    comment: payload.comment,
    adminUrl: `${getPublicSiteUrl()}/admin/resenas?tab=pending`,
    branding: {
      storeName: settings.store_name,
      logoUrl: settings.logo_url || settings.logo_square_url || "",
      contactEmail: settings.contact_email || "",
      instagramUrl: settings.support_instagram || "",
      tiktokUrl: settings.support_tiktok || "",
    },
  });

  console.log("[email-pending] Nueva reseña pendiente...", {
    to,
    product_id: payload.product.id,
    author: payload.author,
    rating: payload.rating,
  });

  await sendEmail({ to, subject, html });
}

