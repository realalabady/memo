import type { PlatformSettings, Provider } from "./types";

export interface Split {
  subtotal: number;
  commissionRate: number;
  commission: number;
  providerFeeRate: number;
  providerFee: number;
  payoutAmount: number;
}

const toH = (sar: number) => Math.round(sar * 100);
const toSAR = (halalas: number) => halalas / 100;

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

  const subH = toH(subtotal);
  const commissionH = Math.round(subH * commissionRate);
  const feeH = Math.round(subH * providerFeeRate);
  const payoutH = subH - commissionH - (settings.passProviderFee ? feeH : 0);

  return {
    subtotal: toSAR(subH),
    commissionRate,
    commission: toSAR(commissionH),
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
