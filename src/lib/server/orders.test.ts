import { describe, expect, it } from "vitest";
import { normalizeSaPhone, tabbyPaymentIsPaid, type TabbyPayment } from "@/lib/payments/tabby";
import { mergeItems } from "./orders";
import { roleForMerchantStatus } from "./roles";

describe("mergeItems (review finding: duplicate lines bypassed the stock check)", () => {
  it("sums repeated product ids", () => {
    expect(
      mergeItems([
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
        { productId: "p1", quantity: 3 },
      ]),
    ).toEqual([
      { productId: "p1", quantity: 5 },
      { productId: "p2", quantity: 1 },
    ]);
  });
});

describe("tabbyPaymentIsPaid (review finding: CLOSED counted as paid even when refunded)", () => {
  const base: TabbyPayment = { id: "x", status: "CLOSED", amount: "100.00", currency: "SAR", order: { reference_id: "o" } };
  it("requires full capture and no refunds", () => {
    expect(tabbyPaymentIsPaid({ ...base, captures: [{ amount: "100.00" }] }, 100)).toBe(true);
    expect(tabbyPaymentIsPaid({ ...base, captures: [{ amount: "100.00" }], refunds: [{ amount: "100.00" }] }, 100)).toBe(false);
    expect(tabbyPaymentIsPaid({ ...base, captures: [] }, 100)).toBe(false);
    expect(tabbyPaymentIsPaid({ ...base, status: "AUTHORIZED", captures: [{ amount: "100.00" }] }, 100)).toBe(false);
  });
});

describe("normalizeSaPhone", () => {
  it("formats common Saudi mobile inputs to +9665…", () => {
    expect(normalizeSaPhone("0551234567")).toBe("+966551234567");
    expect(normalizeSaPhone("551234567")).toBe("+966551234567");
    expect(normalizeSaPhone("+966 55 123 4567")).toBe("+966551234567");
    expect(normalizeSaPhone("00966551234567")).toBe("+966551234567");
  });
});

describe("roleForMerchantStatus (review finding: suspending a store demoted admins)", () => {
  it("never demotes an admin", () => {
    expect(roleForMerchantStatus("admin", "suspended")).toBe("admin");
    expect(roleForMerchantStatus("admin", "approved")).toBe("admin");
  });
  it("maps store status to merchant/customer for everyone else", () => {
    expect(roleForMerchantStatus("customer", "approved")).toBe("merchant");
    expect(roleForMerchantStatus("merchant", "suspended")).toBe("customer");
  });
});
