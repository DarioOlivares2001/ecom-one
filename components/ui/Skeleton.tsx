import { twMerge } from "tailwind-merge";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={twMerge(
        "animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-border)]",
        className
      )}
      aria-hidden
    />
  );
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={twMerge(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

export function ImageSkeleton({ className }: SkeletonProps) {
  return (
    <Skeleton
      className={twMerge(
        "w-full aspect-square rounded-[var(--radius-md)]",
        className
      )}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden aria-label="Cargando producto">
      <ImageSkeleton />
      <div className="flex flex-col gap-2 px-1">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <div className="flex items-center justify-between mt-1">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-8 w-24 rounded-[var(--radius-full)]" />
        </div>
      </div>
    </div>
  );
}
