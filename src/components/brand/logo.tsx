import { cn } from "@/lib/utils";

/**
 * The memo mark: a circle cut into four quarters — four installments —
 * with the last quarter lifted out in ember: "the rest, later".
 */
export function LogoMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <path d="M15 15V3A12 12 0 0 0 3 15Z" fill="currentColor" />
      <path d="M17 15V3a12 12 0 0 1 12 12Z" fill="currentColor" />
      <path d="M15 17H3a12 12 0 0 0 12 12Z" fill="currentColor" />
      <path
        d="M17 17h12a12 12 0 0 1-12 12Z"
        className={cn("fill-ember", animated && "origin-[17px_17px] transition-transform duration-700 ease-[var(--ease-fluid)] group-hover:translate-x-[1.5px] group-hover:translate-y-[1.5px]")}
        transform={animated ? undefined : "translate(1.4 1.4)"}
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("group inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark animated />
      <span className="font-display text-[1.7rem] leading-none italic tracking-tight">memo</span>
    </span>
  );
}
