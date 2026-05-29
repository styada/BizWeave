import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-[var(--bg-muted)] bg-gradient-to-r from-[var(--bg-muted)] via-white/5 to-[var(--bg-muted)] bg-[length:200%_100%]",
        className
      )}
    />
  );
}
