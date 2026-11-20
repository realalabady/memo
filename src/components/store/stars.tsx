import { Star } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/** Read-only rating: ★ 4.6 (12). Renders nothing until a product has reviews. */
export function Rating({ avg, count, className }: { avg?: number; count?: number; className?: string }) {
  if (!count || !avg) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px] text-muted tabular-nums", className)}>
      <Star weight="fill" className="size-3.5 text-ember" />
      <span className="text-ink">{avg.toFixed(1)}</span>
      <span>({count})</span>
    </span>
  );
}

/** Five stars with `value` filled (used inside reviews). */
export function StarRow({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} weight={n <= Math.round(value) ? "fill" : "light"} className={cn("size-4", n <= Math.round(value) ? "text-ember" : "text-ink/25")} />
      ))}
    </span>
  );
}
