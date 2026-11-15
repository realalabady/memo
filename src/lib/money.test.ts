import { describe, expect, it } from "vitest";
import { computeSplit, providerAvailable } from "./money";
import { DEFAULT_SETTINGS } from "./types";

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
});

describe("providerAvailable", () => {
  it("respects each provider's SAR window", () => {
    expect(providerAvailable("tabby", 10)).toBe(true);
    expect(providerAvailable("tamara", 99.99)).toBe(false);
    expect(providerAvailable("tamara", 10_000.01)).toBe(false);
  });
});
