import { describe, expect, it } from "vitest";
import { landing } from "./landing";

describe("landing", () => {
  it("goes to the role's home without next", () => {
    expect(landing("admin", null)).toBe("/admin");
    expect(landing("merchant", null)).toBe("/merchant");
    expect(landing("customer", null)).toBe("/account");
  });

  it("keeps next when the role may use it", () => {
    expect(landing("admin", "/admin/payments")).toBe("/admin/payments");
    expect(landing("admin", "/merchant")).toBe("/merchant");
    expect(landing("customer", "/checkout")).toBe("/checkout");
    expect(landing("merchant", "/product/abc?x=1")).toBe("/product/abc?x=1");
  });

  it("ignores next that points at another role's area", () => {
    expect(landing("admin", "/account")).toBe("/admin");
    expect(landing("merchant", "/account?tab=orders")).toBe("/merchant");
    expect(landing("customer", "/admin")).toBe("/account");
    expect(landing("customer", "/merchant/products")).toBe("/account");
    expect(landing("merchant", "/admin")).toBe("/merchant");
  });
});
