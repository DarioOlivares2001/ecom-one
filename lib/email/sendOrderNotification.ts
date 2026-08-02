import { sendEmail } from "@/lib/email/resend";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { generateDisplayCode } from "@/lib/orders/generateDisplayCode";
import { getOrderCustomerHtml } from "@/lib/email/templates/orderCustomer";
import { getOrderAdminHtml } from "@/lib/email/templates/orderAdmin";

type OrderNotificationItem = {
  name?: string;
  quantity?: number;
  price?: number;
};

type OrderNotificationPayload = {
  orderNumber?: number | string | null;
  orderStatus: "pending" | "paid" | "shipped" | "delivered" | "cancelled";
  only?: "customer" | "admin";
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string | null;
  shippingAddress?: { direccion?: string; ciudad?: string; region?: string } | null;
  items?: OrderNotificationItem[];
  total: number;
  subtotal?: number;
  shippingCost?: number;
};

export async function sendOrderNotification(payload: OrderNotificationPayload) {
  const settings = await getStoreSettings();
  const address = payload.shippingAddress
    ? `${payload.shippingAddress.direccion ?? ""}, ${payload.shippingAddress.ciudad ?? ""}, ${payload.shippingAddress.region ?? ""}`
    : "No informada";

  const customerTo = payload.customerEmail?.trim();
  const adminTo = process.env.STORE_CONTACT_EMAIL?.trim();
  const statusLabel =
    payload.orderStatus === "pending"
      ? "pending (pago pendiente)"
      : payload.orderStatus;
  const branding = {
    storeName: settings.store_name,
    logoUrl: settings.logo_url || settings.logo_square_url || "",
    contactEmail: settings.contact_email || "",
    instagramUrl: settings.support_instagram || "",
    tiktokUrl: settings.support_tiktok || "",
    whatsappNumber: settings.support_whatsapp || "",
  };

  const orderNum = Number(payload.orderNumber);
  const displayCode = Number.isFinite(orderNum) && orderNum > 0
    ? generateDisplayCode(orderNum, settings.order_number_offset)
    : null;

  const customerSubject = `Recibimos tu pedido en ${branding.storeName}`;
  const customerHtml = getOrderCustomerHtml({
    customerName: payload.customerName,
    orderNumber: payload.orderNumber,
    displayCode,
    items: payload.items,
    subtotal: payload.subtotal,
    shippingCost: payload.shippingCost,
    total: payload.total,
    phone: payload.customerPhone,
    shippingAddress: address,
    orderStatus: statusLabel,
    branding,
  });

  const adminSubject = `Nuevo pedido — ${branding.storeName}`;
  const adminHtml = getOrderAdminHtml({
    orderNumber: payload.orderNumber,
    displayCode,
    customerName: payload.customerName,
    customerEmail: customerTo,
    customerPhone: payload.customerPhone,
    shippingAddress: address,
    items: payload.items,
    total: payload.total,
    orderStatus: statusLabel,
    branding,
  });

  if (payload.only !== "admin") {
    if (customerTo) {
      console.log("[order-email-customer] enviando a:", customerTo);
      try {
        await sendEmail({ to: customerTo, subject: customerSubject, html: customerHtml });
      } catch (error) {
        console.error("[order-email-error] customer", error);
      }
    } else {
      console.error("[order-email-error] customer_email faltante para pedido:", payload.orderNumber);
    }
  }

  if (payload.only !== "customer") {
    if (adminTo) {
      console.log("[order-email-admin] enviando a:", adminTo);
      try {
        await sendEmail({ to: adminTo, subject: adminSubject, html: adminHtml });
      } catch (error) {
        console.error("[order-email-error] admin", error);
      }
    } else {
      console.error("[order-email-error] STORE_CONTACT_EMAIL no configurado.");
    }
  }
}

