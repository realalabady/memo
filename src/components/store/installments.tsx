"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { ProviderChip } from "@/components/ui/primitives";
import { expo } from "@/components/ui/motion";
import { providerAvailable } from "@/lib/money";
import { cn, formatSAR, installment } from "@/lib/utils";

const quarters = [
  "M15 15V3A12 12 0 0 0 3 15Z",
  "M17 15V3a12 12 0 0 1 12 12Z",
  "M17 17h12a12 12 0 0 1-12 12Z",
  "M15 17H3a12 12 0 0 0 12 12Z",
];

/** The brand mark as a progress ring: each quarter is one installment. */
export function QuarterRing({ paid = 1, className }: { paid?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-10", className)} aria-hidden>
      {quarters.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          initial={{ opacity: 0.15, scale: 0.8 }}
          whileInView={{ opacity: i < paid ? 1 : 0.15, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.15 * i, ease: expo }}
          style={{ transformOrigin: "16px 16px" }}
          className={i === 0 ? "fill-ember" : "fill-ink"}
        />
      ))}
    </svg>
  );
}

/** Installment schedule shown on product + checkout pages. */
export function InstallmentPlan({ amount, compact }: { amount: number; compact?: boolean }) {
  const [provider, setProvider] = useState<"tabby" | "tamara">("tabby");
  const per = installment(amount);
  const labels = ["Today", "In 1 month", "In 2 months", "In 3 months"];
  const available = providerAvailable(provider, amount);

  return (
    <div className="rounded-[1.75rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06]">
      <div className="rounded-[calc(1.75rem-0.375rem)] bg-paper p-5 shadow-[var(--shadow-inset)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            Split into 4 — <span className="font-medium">{formatSAR(per, { decimals: true })}</span>/mo
          </p>
          <div className="flex rounded-full bg-ink/[0.05] p-1">
            {(["tabby", "tamara"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={cn("relative rounded-full px-3 py-1 text-[12px] transition-colors", provider === p ? "text-ink" : "text-muted")}
              >
                {provider === p && (
                  <motion.span layoutId="provider-pill" className="absolute inset-0 rounded-full bg-paper shadow-sm" transition={{ ease: expo, duration: 0.5 }} />
                )}
                <span className="relative">{p}</span>
              </button>
            ))}
          </div>
        </div>
        {!compact && (
          <ol className="mt-5 grid grid-cols-4 gap-2">
            {labels.map((l, i) => (
              <li key={l} className="flex flex-col items-center gap-2 text-center">
                <QuarterRing paid={i + 1} className="size-8" />
                <span className="text-[13px] tabular-nums">{formatSAR(per, { decimals: true })}</span>
                <span className="text-[11px] text-muted">{l}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 flex items-center gap-2 text-[12px] text-muted">
          <ProviderChip provider={provider} />
          {available ? "No interest. No fees when you pay on time." : `Not available for this amount with ${provider}.`}
        </p>
      </div>
    </div>
  );
}
