import { describe, expect, it } from "vitest";
import { matchesTx, txCsvLine } from "./csv";
import { DEFAULT_LEGAL, LEGAL_SLUGS, parseBlocks, withLegalDefaults } from "./legal";
import { alternates, clip, jsonLd } from "./seo";
import type { MerchantOrder } from "./types";

describe("legal page text format", () => {
  it("parses headings, bullets and paragraphs", () => {
    const blocks = parseBlocks("Intro line\ncontinues.\n\n## Heading\n- one\n- two\n\nAfter.");
    expect(blocks).toEqual([
      { kind: "p", text: "Intro line continues." },
      { kind: "h2", text: "Heading" },
      { kind: "ul", items: ["one", "two"] },
      { kind: "p", text: "After." },
    ]);
  });

  it("keeps HTML as plain text (rendered as text nodes, never as markup)", () => {
    expect(parseBlocks("<script>alert(1)</script>")).toEqual([{ kind: "p", text: "<script>alert(1)</script>" }]);
  });

  it("has built-in English and Arabic text for every page, and fills gaps in edited ones", () => {
    for (const slug of LEGAL_SLUGS) {
      expect(DEFAULT_LEGAL[slug].body.length).toBeGreaterThan(100);
      expect(DEFAULT_LEGAL[slug].bodyAr.length).toBeGreaterThan(100);
    }
    const page = withLegalDefaults("returns", { title: "Returns", body: "Custom", updatedAt: 5 });
    expect(page).toMatchObject({ title: "Returns", body: "Custom", titleAr: DEFAULT_LEGAL.returns.titleAr, updatedAt: 5 });
  });
});

describe("seo helpers", () => {
  it("builds canonical and hreflang links", () => {
    expect(alternates("en", "/shop")).toEqual({
      canonical: "/en/shop",
      languages: { ar: "/ar/shop", en: "/en/shop", "x-default": "/ar/shop" },
    });
    expect(alternates("ar", "/")?.canonical).toBe("/ar");
  });
  it("clips descriptions and escapes JSON-LD", () => {
    expect(clip("a  b\n c")).toBe("a b c");
    expect(clip("x".repeat(200)).length).toBe(160);
    expect(jsonLd({ name: "</script><b>" })).not.toContain("</script>");
  });
});

describe("transactions CSV", () => {
  const row = {
    id: "o_m",
    orderId: "o1",
    merchantId: "m",
    merchantName: "Store",
    customerId: "c",
    customer: { firstName: "=cmd", lastName: "A", email: "a@b.c", phone: "05", city: "Riyadh", line1: "x" },
    items: [{ productId: "p", merchantId: "m", title: "Lamp", titleAr: "مصباح", unitPrice: 10, quantity: 1, total: 10 }],
    provider: "tabby",
    subtotal: 10,
    commissionRate: 0.1,
    commission: 1,
    providerFeeRate: 0,
    providerFee: 0,
    payoutAmount: 9,
    paymentStatus: "captured",
    fulfillmentStatus: "pending",
    payoutStatus: "unpaid",
    createdAt: 0,
  } as MerchantOrder;

  it("neutralises spreadsheet formulas", () => {
    expect(txCsvLine(row)).toContain(`"'=cmd A"`);
  });
  it("filters by provider, payout and Arabic product names", () => {
    expect(matchesTx(row, { q: "مصباح" })).toBe(true);
    expect(matchesTx(row, { provider: "tamara" })).toBe(false);
    expect(matchesTx(row, { payout: "paid" })).toBe(false);
  });
});
