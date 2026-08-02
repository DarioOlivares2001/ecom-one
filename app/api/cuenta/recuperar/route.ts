import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: row, error: selErr } = await admin
      .from("clientes")
      .select("id,email,nombre,password_hash")
      .eq("email", normEmail)
      .maybeSingle();

    if (selErr) {
      console.error("[cuenta-recuperar] select", selErr.message);
      return NextResponse.json({ ok: true as const });
    }

    if (row?.password_hash) {
      const token = randomUUID();
      const expiresIso = new Date(Date.now() + RESET_TTL_MS).toISOString();

      const { error: upErr } = await admin
        .from("clientes")
        .update({
          reset_token: token,
          reset_token_expires: expiresIso,
        })
        .eq("email", normEmail);

      if (upErr) {
        console.error("[cuenta-recuperar] update token", upErr.message);
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
        await admin
          .from("clientes")
          .update({ reset_token: null, reset_token_expires: null })
          .eq("email", normEmail);
      }
    }

    return NextResponse.json({ ok: true as const });
  } catch (e) {
    console.error("[cuenta-recuperar] excepción", e);
    return NextResponse.json({ ok: true as const });
  }
}
