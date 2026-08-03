import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getClienteByEmail, updateCliente } from "@/lib/db/repositories/clientes";
import { normalizeClienteEmail } from "@/lib/clientes/normalizeClienteEmail";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { sendResetPasswordEmail } from "@/lib/email/sendResetPasswordEmail";
import { getPublicSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
});

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    }

    const normEmail = normalizeClienteEmail(parsed.data.email);

    let row;
    try {
      row = await getClienteByEmail(normEmail);
    } catch (selErr) {
      console.error("[cuenta-recuperar] select", selErr);
      return NextResponse.json({ ok: true as const });
    }

    if (row?.password_hash) {
      const token = randomUUID();
      const expiresIso = new Date(Date.now() + RESET_TTL_MS).toISOString();

      try {
        await updateCliente(row.id, {
          reset_token: token,
          reset_token_expires: expiresIso,
        });
      } catch (upErr) {
        console.error("[cuenta-recuperar] update token", upErr);
        return NextResponse.json({ ok: true as const });
      }

      const base = getPublicSiteUrl().replace(/\/+$/, "");
      const resetUrl = `${base}/cuenta/reset?token=${encodeURIComponent(token)}`;
      const settings = await getStoreSettings();

      try {
        await sendResetPasswordEmail({
          to: normEmail,
          customerName: String(row.nombre ?? "Cliente"),
          storeName: settings.store_name,
          resetUrl,
        });
      } catch (e) {
        console.error("[cuenta-recuperar] email", e);
        await updateCliente(row.id, { reset_token: null, reset_token_expires: null });
      }
    }

    return NextResponse.json({ ok: true as const });
  } catch (e) {
    console.error("[cuenta-recuperar] excepción", e);
    return NextResponse.json({ ok: true as const });
  }
}
