import {
  CheckCircle2,
  Clock,
  Heart,
  Leaf,
  Package,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Truck,
  type LucideIcon,
} from "lucide-react";

import type { BenefitIcon } from "@/lib/product/sections/types";

export const BENEFIT_ICON_MAP: Record<BenefitIcon, LucideIcon> = {
  shield: ShieldCheck,
  truck: Truck,
  leaf: Leaf,
  heart: Heart,
  sparkles: Sparkles,
  check: CheckCircle2,
  star: Star,
  package: Package,
  smile: Smile,
  clock: Clock,
};

export function getBenefitIcon(icon: BenefitIcon): LucideIcon {
  return BENEFIT_ICON_MAP[icon] ?? CheckCircle2;
}
