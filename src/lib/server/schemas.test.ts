import { describe, expect, it } from "vitest";
import { merchantApplyInput } from "./schemas";

const base = { storeName: "Test", city: "Khobar", phone: "0511567408", acceptTerms: true };

describe("merchantApplyInput business type", () => {
  it("needs a 10-digit CR number starting with 7", () => {
    expect(merchantApplyInput.safeParse({ ...base, businessType: "cr", crNumber: "7012345678" }).success).toBe(true);
    expect(merchantApplyInput.safeParse({ ...base, businessType: "cr", crNumber: "1012345678" }).success).toBe(false);
    expect(merchantApplyInput.safeParse({ ...base, businessType: "cr", crNumber: "701234567" }).success).toBe(false);
  });

  it("defaults to CR for older clients that send no type", () => {
    expect(merchantApplyInput.safeParse({ ...base, crNumber: "7012345678" }).success).toBe(true);
    expect(merchantApplyInput.safeParse({ ...base, crNumber: "" }).success).toBe(false);
  });

  it("needs an FL- freelance document number (any case, dash optional)", () => {
    expect(merchantApplyInput.safeParse({ ...base, businessType: "freelance", freelanceNumber: "FL-123456789" }).success).toBe(true);
    expect(merchantApplyInput.safeParse({ ...base, businessType: "freelance", freelanceNumber: "fl123456789" }).success).toBe(true);
    expect(merchantApplyInput.safeParse({ ...base, businessType: "freelance", freelanceNumber: "123456789" }).success).toBe(false);
  });

  it("needs no number when the seller has neither", () => {
    expect(merchantApplyInput.safeParse({ ...base, businessType: "none" }).success).toBe(true);
  });
});
