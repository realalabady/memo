import { describe, expect, it } from "vitest";
import { computeSplit, payoutEligibility, providerAvailable, vatIncluded } from "./money";
import { DEFAULT_SETTINGS } from "./types";
import { zatcaQrPayload } from "./zatca";

describe("computeSplit", () => {
  it("splits a Tabby payment into commission, provider fee and payout to the halala", () => {
    const s = computeSplit(1290, "tabby", DEFAULT_SETTINGS);
    expect(s.commission).toBe(129);
    expect(s.providerFee).toBe(64.37);
    expect(s.payoutAmount).toBe(1096.63);
    expect(s.commission + s.providerFee + s.payoutAmount).toBeCloseTo(1290, 2);
  });

  it("uses the merchant's commission override, including 0", () => {
    expect(computeSplit(100, "tamara", DEFAULT_SETTINGS, 0.05).commission).toBe(5);
    expect(computeSplit(100, "tamara", DEFAULT_SETTINGS, 0).commission).toBe(0);
  });

  it("keeps the provider fee with the platform when passProviderFee is off", () => {
    const s = computeSplit(200, "tabby", { ...DEFAULT_SETTINGS, passProviderFee: false });
    expect(s.payoutAmount).toBe(180);
  });

  it("charges no provider fee for demo orders", () => {
    expect(computeSplit(50, "demo", DEFAULT_SETTINGS).providerFee).toBe(0);
  });

  it("reports the VAT contained in a VAT-inclusive price without changing the payout", () => {
    const s = computeSplit(115, "demo", DEFAULT_SETTINGS);
    expect(s.vatAmount).toBe(15);
    expect(s.commissionVat).toBe(0);
    expect(s.payoutAmount).toBe(103.5);
  });

  it("deducts VAT on the commission when vatOnCommission is on", () => {
    const s = computeSplit(1000, "demo", { ...DEFAULT_SETTINGS, vatOnCommission: true });
    expect(s.commission).toBe(100);
    expect(s.commissionVat).toBe(15);
    expect(s.payoutAmount).toBe(885);
  });
});

describe("vatIncluded", () => {
  it("extracts 15% VAT from gross amounts to the halala", () => {
    expect(vatIncluded(115, 0.15)).toBe(15);
    expect(vatIncluded(1290, 0.15)).toBe(168.26);
    expect(vatIncluded(100, 0)).toBe(0);
  });
});

describe("providerAvailable", () => {
  it("respects each provider's SAR window", () => {
    expect(providerAvailable("tabby", 10)).toBe(true);
    expect(providerAvailable("tamara", 99.99)).toBe(false);
    expect(providerAvailable("tamara", 10_000.01)).toBe(false);
  });
});

describe("payoutEligibility", () => {
  const day = 86_400_000;
  const now = 1_800_000_000_000;
  const base = { paymentStatus: "captured", payoutStatus: "unpaid", fulfillmentStatus: "delivered", createdAt: now - 30 * day } as const;
  const settings = { payoutHoldDays: 3 };

  it("is payable once delivered and past the hold period", () => {
    expect(payoutEligibility({ ...base, deliveredAt: now - 4 * day }, settings, now)).toEqual({ eligible: true });
  });
  it("waits for delivery", () => {
    expect(payoutEligibility({ ...base, fulfillmentStatus: "shipped" }, settings, now)).toMatchObject({ eligible: false, reason: "not_delivered" });
  });
  it("waits out the hold period and says when it ends", () => {
    expect(payoutEligibility({ ...base, deliveredAt: now - day }, settings, now)).toEqual({
      eligible: false,
      reason: "hold_period",
      eligibleAt: now + 2 * day,
    });
  });
  it("never pays unpaid, refunded, held or already-settled rows", () => {
    expect(payoutEligibility({ ...base, paymentStatus: "refunded" }, settings, now)).toMatchObject({ reason: "not_paid" });
    expect(payoutEligibility({ ...base, payoutStatus: "on_hold" }, settings, now)).toMatchObject({ reason: "on_hold" });
    expect(payoutEligibility({ ...base, payoutStatus: "paid" }, settings, now)).toMatchObject({ reason: "settled" });
  });
});

describe("zatcaQrPayload", () => {
  it("encodes the five TLV fields as base64", () => {
    const b64 = zatcaQrPayload({ sellerName: "memo", vatNumber: "300000000000003", timestamp: Date.UTC(2026, 10, 16, 9, 30), total: 115, vat: 15 });
    const bytes = [...atob(b64)].map((ch) => ch.charCodeAt(0));
    expect(bytes.slice(0, 6)).toEqual([1, 4, 109, 101, 109, 111]); // tag 1, length 4, "memo"
    const text = atob(b64);
    expect(text).toContain("300000000000003");
    expect(text).toContain("2026-11-16T09:30:00Z");
    expect(text).toContain("115.00");
    expect(text).toContain("15.00");
  });
});
