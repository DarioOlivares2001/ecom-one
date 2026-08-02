"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toast";

type ReviewStatusTab = "pending" | "approved" | "rejected";
type ActionKind = "approve" | "reject" | "hide";
type ActionFn = (id: string) => Promise<{ error?: string }>;

export function ReviewActions({
  reviewId,
  status,
  active,
  approveAction,
  rejectAction,
  hideAction,
}: {
  reviewId: string;
  status: ReviewStatusTab;
  active: boolean;
  approveAction: ActionFn;
  rejectAction: ActionFn;
  hideAction: ActionFn;
}) {
  const [pending, setPending] = useState<ActionKind | null>(null);

  async function run(action: ActionFn, kind: ActionKind, successMessage: string) {
    setPending(kind);
    try {
      const result = await action(reviewId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(successMessage);
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {status !== "approved" ? (
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run(approveAction, "approve", "Reseña aprobada")}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-600/30 transition hover:scale-[1.02] hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === "approve" ? "Aprobando…" : "Aprobar rápido"}
        </button>
      ) : null}

      {status !== "rejected" ? (
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => {
            if (!window.confirm("¿Seguro que quieres rechazar esta reseña?")) return;
            run(rejectAction, "reject", "Reseña rechazada");
          }}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === "reject" ? "Rechazando…" : "Rechazar"}
        </button>
      ) : null}

      {status === "approved" && active ? (
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run(hideAction, "hide", "Reseña ocultada")}
          className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === "hide" ? "Ocultando…" : "Ocultar aprobada"}
        </button>
      ) : null}
    </div>
  );
}
