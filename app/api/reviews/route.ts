import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendReviewNotification } from "@/lib/email/sendReviewNotification";

const bodySchema = z.object({
  product_id: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5),
  author_name: z.string().trim().min(2).max(80),
  author_email: z.string().email().optional().or(z.literal("")),
  comment: z.string().trim().min(3).max(2000),
  photo_url: z.string().url().optional().or(z.literal("")),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos de reseña inválidos." }, { status: 400 });
    }

    const payload = parsed.data;
    if (!payload.product_id || !payload.author_name || !payload.comment) {
      return NextResponse.json({ error: "Datos de reseña incompletos." }, { status: 400 });
    }

    const supabase = createClient();
    const fullInsert = {
      product_id: payload.product_id,
      author_name: payload.author_name,
      author_email: payload.author_email?.trim() || null,
      rating: payload.rating,
      comment: payload.comment,
      photo_url: payload.photo_url?.trim() || null,
      verified: false,
      active: false,
      status: "pending",
    };
    let { error } = await supabase
      .from("reviews")
      .insert(fullInsert as never);
    let savedReview = !error;

    if (error) {
      console.error("[api/reviews] Error insert reviews (full payload):", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        payloadKeys: Object.keys(fullInsert),
      });

      const missingColumnError =
        /column .* does not exist/i.test(error.message ?? "") ||
        error.code === "42703";

      if (missingColumnError) {
        const legacyInsert = {
          product_id: payload.product_id,
          author_name: payload.author_name,
          rating: payload.rating,
          comment: payload.comment,
          verified: false,
          active: false,
        };
        const retry = await supabase
          .from("reviews")
          .insert(legacyInsert as never);
        if (!retry.error) {
          savedReview = true;
          error = null;
        } else {
          error = retry.error;
        }
        if (error) {
          console.error("[api/reviews] Error insert reviews (legacy fallback):", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            payloadKeys: Object.keys(legacyInsert),
          });
        }
      }

      if (!savedReview) {
        return NextResponse.json(
          { error: error?.message || "No se pudo guardar la reseña." },
          { status: 500 }
        );
      }
    }

    try {
      console.log("[email] trigger notificación reseña pendiente");
      const { data: productRow } = await supabase
        .from("products")
        .select("id,name")
        .eq("id", payload.product_id)
        .maybeSingle();
      await sendReviewNotification({
        product: {
          id: payload.product_id,
          name: (productRow as { name?: string | null } | null)?.name ?? null,
        },
        author: payload.author_name,
        authorEmail: payload.author_email?.trim() || null,
        rating: payload.rating,
        comment: payload.comment,
      });
    } catch (notifyError) {
      console.error("[email-error] Falló notificación de reseña:", notifyError);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[api/reviews] Excepción inesperada:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

