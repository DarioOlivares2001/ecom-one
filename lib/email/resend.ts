import { Resend } from "resend";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.STORE_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    console.warn("[email-error] Resend no configurado (faltan RESEND_API_KEY o STORE_FROM_EMAIL).");
    return;
  }

  const resend = new Resend(apiKey);
  console.log("[email] enviando correo a:", to);
  try {
    const response = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });
    console.log("[email-response]", response);
  } catch (error) {
    console.error("[email-error]", error);
    throw error;
  }
}

