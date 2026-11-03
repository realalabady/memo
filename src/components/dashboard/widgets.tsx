"use client";

import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { expo } from "@/components/ui/motion";
import type { MerchantOrder } from "@/lib/types";
import { cn, formatSAR } from "@/lib/utils";

/** Count-up number that animates when scrolled into view. */
export function CountUp({ value, format = (n) => formatSAR(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration: 1.4, ease: expo });
    return () => controls.stop();
  }, [inView, value, mv]);
  return <motion.span ref={ref}>{text}</motion.span>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "paper",
  index = 0,
  format,
}: {
  label: string;
  value: number;
  hint?: ReactNode;
  tone?: "paper" | "ink" | "ember";
  index?: number;
  format?: (n: number) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.9, delay: 0.06 * index, ease: expo }}
      className={cn("rounded-[1.75rem] p-1.5 ring-1", tone === "paper" ? "bg-ink/[0.03] ring-ink/[0.06]" : "bg-ink/10 ring-ink/10")}
    >
      <div
        className={cn(
          "flex h-full flex-col rounded-[calc(1.75rem-0.375rem)] p-5",
          tone === "paper" && "bg-paper shadow-[var(--shadow-inset)]",
          tone === "ink" && "bg-ink text-paper",
          tone === "ember" && "bg-ember text-paper",
        )}
      >
        <p className={cn("text-[11px] font-medium uppercase tracking-[0.14em]", tone === "paper" ? "text-muted" : "text-paper/70")}>{label}</p>
        <p className="font-display mt-6 text-4xl tabular-nums">
          <CountUp value={value} format={format} />
        </p>
        {hint && <p className={cn("mt-2 text-[12px]", tone === "paper" ? "text-muted" : "text-paper/70")}>{hint}</p>}
      </div>
    </motion.div>
  );
}

/** Daily revenue area chart drawn in SVG; the line draws itself in. */
export function RevenueChart({ orders, days = 14, title = "Sales, last 14 days" }: { orders: MerchantOrder[]; days?: number; title?: string }) {
  const series = useMemo(() => {
    const dayMs = 86_400_000;
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const buckets = Array.from({ length: days }, (_, i) => ({
      t: end.getTime() - (days - 1 - i) * dayMs,
      v: 0,
    }));
    for (const o of orders) {
      if (o.paymentStatus !== "captured") continue;
      const idx = days - 1 - Math.floor((end.getTime() - o.createdAt) / dayMs);
      if (idx >= 0 && idx < days) buckets[idx].v += o.subtotal;
    }
    return buckets;
  }, [orders, days]);

  const W = 640;
  const H = 180;
  const max = Math.max(1, ...series.map((s) => s.v));
  const pts = series.map((s, i) => [(i / (series.length - 1)) * W, H - (s.v / max) * (H - 16) - 8] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const total = series.reduce((s, x) => s + x.v, 0);

  return (
    <div className="rounded-[1.75rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06]">
      <div className="rounded-[calc(1.75rem-0.375rem)] bg-paper p-5 shadow-[var(--shadow-inset)]">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{title}</p>
          <p className="font-display text-2xl tabular-nums">{formatSAR(Math.round(total))}</p>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-44 w-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-ember)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-ember)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="var(--color-ink)" strokeOpacity="0.05" vectorEffect="non-scaling-stroke" />
          ))}
          <motion.path d={area} fill="url(#area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: 0.6 }} />
          <motion.path
            d={line}
            fill="none"
            stroke="var(--color-ember)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: expo }}
          />
        </svg>
        <div className="mt-2 flex justify-between text-[10px] text-muted">
          <span>{new Date(series[0].t).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.15, ease: expo }}
      className={cn("min-w-0 rounded-[1.75rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06]", className)}
    >
      <div className="h-full min-w-0 rounded-[calc(1.75rem-0.375rem)] bg-paper shadow-[var(--shadow-inset)]">
        {(title || actions) && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-5">
            {title && <p className="font-display text-2xl italic">{title}</p>}
            {actions}
          </div>
        )}
        {children}
      </div>
    </motion.div>
  );
}

/** Horizontally-scrollable table wrapper with consistent styling */
export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto px-2 pb-2">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.14em] text-muted">
            {head.map((h) => (
              <th key={h} className="px-3 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-ink/[0.05] [&>tr:hover]:bg-cream/50 [&_td]:px-3 [&_td]:py-3">{children}</tbody>
      </table>
      {empty && <p className="py-12 text-center text-sm text-muted">Nothing here yet.</p>}
    </div>
  );
}

export function sum<T>(rows: T[], pick: (r: T) => number) {
  return Math.round(rows.reduce((s, r) => s + pick(r), 0) * 100) / 100;
}
