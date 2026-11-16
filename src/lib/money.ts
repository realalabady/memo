import type { MerchantOrder, PlatformSettings, Provider } from "./types";

export interface Split {
  subtotal: number;
  /** VAT contained in the (VAT-inclusive) subtotal */
  vatAmount: number;
  commissionRate: number;
  commission: number;
  /** VAT added on top of the commission (0 unless settings.vatOnCommission) */
  commissionVat: number;
  providerFeeRate: number;
  providerFee: number;
  payoutAmount: number;
}

const toH = (sar: number) => Math.round(sar * 100);
const toSAR = (halalas: number) => halalas / 100;

/** VAT contained in a VAT-inclusive amount: 115 at 15% → 15. */
export function vatIncluded(gross: number, rate: number) {
  return toSAR(Math.round((toH(gross) * rate) / (1 + rate)));
}

/**
 * How a merchant's share of a BNPL payment is split.
 * The full amount lands in the platform's Tabby/Tamara account; `payoutAmount`
 * is what the admin owes (and later transfers to) the merchant.
 */
export function computeSplit(
  subtotal: number,
  provider: Provider | "demo",
  settings: PlatformSettings,
  merchantCommissionRate?: number,
): Split {
  const commissionRate = merchantCommissionRate ?? settings.commissionRate;
  const providerFeeRate =
    provider === "tabby"
      ? settings.tabbyFeeRate
      : provider === "tamara"
        ? settings.tamaraFeeRate
        : 0;
  const vatRate = settings.vatRate ?? 0;

  const subH = toH(subtotal);
  const commissionH = Math.round(subH * commissionRate);
  const commissionVatH = settings.vatOnCommission ? Math.round(commissionH * vatRate) : 0;
  const feeH = Math.round(subH * providerFeeRate);
  const payoutH = subH - commissionH - commissionVatH - (settings.passProviderFee ? feeH : 0);

  return {
    subtotal: toSAR(subH),
    vatAmount: vatIncluded(subtotal, vatRate),
    commissionRate,
    commission: toSAR(commissionH),
    commissionVat: toSAR(commissionVatH),
    providerFeeRate,
    providerFee: toSAR(feeH),
    payoutAmount: toSAR(payoutH),
  };
}

/** Provider eligibility windows (SAR). Adjust to your contract limits. */
export const PROVIDER_LIMITS: Record<Provider, { min: number; max: number }> = {
  tabby: { min: 10, max: 10000 },
  tamara: { min: 100, max: 10000 },
};

export function providerAvailable(provider: Provider, total: number) {
  const l = PROVIDER_LIMITS[provider];
  return total >= l.min && total <= l.max;
}

const DAY_MS = 86_400_000;

export type PayoutBlock = "not_paid" | "settled" | "on_hold" | "not_delivered" | "hold_period";

/**
 * Can this ledger row be paid out now? A row is payable once the order is paid,
 * delivered, and the hold period (returns window) has passed.
 */
export function payoutEligibility(
  row: Pick<MerchantOrder, "paymentStatus" | "payoutStatus" | "fulfillmentStatus" | "deliveredAt" | "createdAt">,
  settings: Pick<PlatformSettings, "payoutHoldDays">,
  now = Date.now(),
): { eligible: true } | { eligible: false; reason: PayoutBlock; eligibleAt?: number } {
  if (row.paymentStatus !== "captured") return { eligible: false, reason: "not_paid" };
  if (row.payoutStatus === "paid") return { eligible: false, reason: "settled" };
  if (row.payoutStatus === "on_hold") return { eligible: false, reason: "on_hold" };
  if (row.fulfillmentStatus !== "delivered") return { eligible: false, reason: "not_delivered" };
  const eligibleAt = (row.deliveredAt ?? row.createdAt) + (settings.payoutHoldDays ?? 0) * DAY_MS;
  if (eligibleAt > now) return { eligible: false, reason: "hold_period", eligibleAt };
  return { eligible: true };
}
