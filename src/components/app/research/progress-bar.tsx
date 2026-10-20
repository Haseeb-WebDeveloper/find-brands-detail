import { cn } from "@/design/cn";

/** How much of something is done. `active` adds a soft shimmer while work is running. */
export function ProgressBar({ done, total, active = false, className }: { done: number; total: number; active?: boolean; className?: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-fill", className)}
    >
      <div className={cn("h-full rounded-full bg-tint transition-[width] duration-500", pct === 100 && "bg-system-green")} style={{ width: `${pct}%` }} />
      {active ? <div aria-hidden className="absolute inset-0 animate-pulse bg-tint/15" /> : null}
    </div>
  );
}
