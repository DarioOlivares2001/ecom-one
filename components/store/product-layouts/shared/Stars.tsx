import { Star } from "lucide-react";
import { clsx } from "clsx";

export function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={clsx(dim, i <= rating ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200")}
        />
      ))}
    </div>
  );
}
