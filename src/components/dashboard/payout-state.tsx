"use client";

import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { payoutEligibility } from "@/lib/money";
import type { MerchantOrder, PlatformSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "Ready to pay" / "Awaiting delivery" / "Payable on 12 Nov" / "On hold" for one ledger row. */
export function PayoutState({ row, settings }: { row: MerchantOrder; settings: PlatformSettings }) {
  const t = useT().payoutState;
  const { date } = useFormat();
  const check = payoutEligibility(row, settings);
  const label = check.eligible
    ? t.eligible
    : check.reason === "hold_period" && check.eligibleAt
      ? fmt(t.hold_period, { date: date(check.eligibleAt) })
      : t[check.reason];
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        check.eligible ? "bg-sage-soft text-[#4c5a3f]" : check.reason === "on_hold" ? "bg-ink text-paper" : "bg-sand text-ink-2",
      )}
    >
      {label}
    </span>
  );
}
