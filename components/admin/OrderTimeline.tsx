"use client";

import { CheckCircle2, ClipboardList, PackageSearch, Truck, Home, Crown, Sparkles } from "lucide-react";
import { normalizeOrderStatusKey } from "@/lib/orders/formatOrderStatus";

type TimelineVisualState = "completed" | "current" | "pending";

interface Step {
  title: string;
  shortTitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: Step[] = [
  {
    title: "Pedido recibido",
    shortTitle: "Recibido",
    description: "Pago registrado y orden creada.",
    icon: ClipboardList,
  },
  {
    title: "Preparando",
    shortTitle: "Prep.",
    description: "Alistando productos.",
    icon: PackageSearch,
  },
  {
    title: "En despacho",
    shortTitle: "Envío",
    description: "En camino al destino.",
    icon: Truck,
  },
  {
    title: "Entregado",
    shortTitle: "OK",
    description: "Recepción confirmada.",
    icon: Home,
  },
];

function getCurrentStep(status: string): number | null {
  const normalized = normalizeOrderStatusKey(status);
  if (normalized === "cancelled" || normalized === "failed" || normalized === "refunded") return null;
  if (normalized === "pending" || normalized === "paid") return 0;
  if (normalized === "preparing" || normalized === "processing") return 1;
  if (normalized === "shipped") return 2;
  if (normalized === "delivered") return 3;
  return 0;
}

function getStepState(stepIndex: number, currentStep: number): TimelineVisualState {
  if (stepIndex < currentStep) return "completed";
  if (stepIndex === currentStep) return "current";
  return "pending";
}

function clsByState(state: TimelineVisualState) {
  if (state === "completed") {
    return {
      node: "border-emerald-500 bg-emerald-500 text-white shadow-sm",
      icon: "text-white",
      title: "text-zinc-900",
    };
  }
  if (state === "current") {
    return {
      node: "border-zinc-900 bg-zinc-900 text-white shadow-md ring-[3px] ring-zinc-200",
      icon: "text-white",
      title: "text-zinc-900",
    };
  }
  return {
    node: "border-zinc-200 bg-white text-zinc-400 shadow-sm",
    icon: "text-zinc-400",
    title: "text-zinc-500",
  };
}

/** Nodo último paso cuando el pedido ya está entregado (coronación visual). */
const DELIVERED_CELEBRATION = {
  node:
    "animate-order-timeline-celebrate border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-200 text-amber-900 ring-[3px] ring-amber-200/90 ring-offset-2 ring-offset-white",
  icon: "text-amber-900",
  title: "text-amber-950",
};

export function OrderTimeline({ status, compact = false }: { status: string; compact?: boolean }) {
  const currentStep = getCurrentStep(status);
  const normalizedStatus = normalizeOrderStatusKey(status);
  const isDeliveredCelebration =
    normalizedStatus === "delivered" && currentStep !== null && currentStep >= 3;

  if (currentStep === null) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 ${compact ? "px-3 py-2" : "p-5 md:p-6"}`}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className={`mt-0.5 shrink-0 text-red-600 ${compact ? "h-3.5 w-3.5" : "h-5 w-5"}`} />
          <div>
            <p className={`font-semibold text-red-800 ${compact ? "text-xs" : "text-sm"}`}>Pedido cancelado</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-xl border border-zinc-200/90 bg-gradient-to-br from-white to-zinc-50/90 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] ${compact ? "py-3 pl-3 pr-2" : "p-6 md:p-7"} ${isDeliveredCelebration && !compact ? "overflow-hidden" : ""}`}
    >
      {isDeliveredCelebration && !compact ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(251,191,36,0.18),transparent_65%)]"
          aria-hidden
        />
      ) : null}

      <div className={`relative ${compact ? "pb-1" : "pb-2"}`}>
        <div className="overflow-x-auto">
          <div
            className={`grid grid-cols-4 gap-0 ${compact ? "min-w-[520px] px-0" : "min-w-[760px] px-1 md:min-w-[820px]"}`}
          >
            {STEPS.map((step, idx) => {
              const visualState = getStepState(idx, currentStep);
              const baseCls = clsByState(visualState);
              const isLastDelivered =
                isDeliveredCelebration && idx === STEPS.length - 1 && visualState === "current";
              const Icon = isLastDelivered ? Crown : step.icon;
              const isDone = visualState === "completed";
              const label = compact ? step.shortTitle : step.title;

              const cls = isLastDelivered
                ? {
                    node: DELIVERED_CELEBRATION.node,
                    icon: DELIVERED_CELEBRATION.icon,
                    title: DELIVERED_CELEBRATION.title,
                  }
                : baseCls;

              const nodeSize = compact ? "h-6 w-6" : "h-12 w-12";
              const iconSize = compact ? "h-3 w-3" : "h-6 w-6";
              const lineTop = compact ? "top-3" : "top-6";
              const lineHeight = compact ? "h-0.5" : "h-1";

              return (
                <div key={step.title} className={`relative ${compact ? "px-0.5" : "px-3 md:px-4"}`}>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`absolute right-[-50%] ${lineTop} ${compact ? "left-[calc(50%+0.75rem)]" : "left-[calc(50%+1.5rem)]"}`}
                    >
                      <div
                        className={`${lineHeight} w-full rounded-full ${idx < currentStep ? "bg-emerald-500" : "bg-zinc-200"}`}
                      />
                    </div>
                  )}

                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`relative z-10 flex items-center justify-center rounded-full border-2 ${cls.node} ${nodeSize}`}
                      aria-current={visualState === "current" ? "step" : undefined}
                    >
                      <Icon className={`${iconSize} ${cls.icon}`} />
                      {isLastDelivered && !compact ? (
                        <Sparkles
                          className="pointer-events-none absolute right-1 top-1 h-3.5 w-3.5 text-amber-600 drop-shadow"
                          aria-hidden
                          strokeWidth={2}
                        />
                      ) : null}
                    </div>

                    <p
                      className={`max-w-[10rem] font-semibold leading-tight ${cls.title} ${
                        compact ? "mt-1 max-w-[4.25rem] text-[10px] tracking-tight" : "mt-4 text-sm md:text-base"
                      }`}
                    >
                      {isLastDelivered && !compact ? step.title : label}
                      {isDone && !compact && !isLastDelivered ? " ✓" : ""}
                    </p>
                    {!compact && !isLastDelivered ? (
                      <p className="mt-2 max-w-[180px] text-xs leading-relaxed text-zinc-500 md:max-w-[200px]">
                        {step.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
