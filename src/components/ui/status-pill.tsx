"use client";

import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  captured: "bg-sage-soft text-[#4c5a3f]",
  paid: "bg-sage-soft text-[#4c5a3f]",
  approved: "bg-sage-soft text-[#4c5a3f]",
  delivered: "bg-sage-soft text-[#4c5a3f]",
  active: "bg-sage-soft text-[#4c5a3f]",
  pending: "bg-sand text-ink-2",
  unpaid: "bg-ember-soft text-[#8f321a]",
  shipped: "bg-[#e3e6f2] text-[#3d4673]",
  draft: "bg-sand text-ink-2",
  failed: "bg-ink/5 text-muted line-through",
  cancelled: "bg-ink/5 text-muted line-through",
  refunded: "bg-ink/5 text-muted",
  suspended: "bg-ink text-paper",
  rejected: "bg-ember-soft text-[#8f321a]",
  on_hold: "bg-ink text-paper",
};

export function StatusPill({ status }: { status: string }) {
  const labels = useT().status;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize", tones[status] ?? "bg-ink/5")}>
      {labels[status] ?? status.replace("_", " ")}
    </span>
  );
}
