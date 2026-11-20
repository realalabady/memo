import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TabbyPayment } from "@/lib/payments/tabby";

/**
 * Order money flow against the Firestore emulator (run via `npm run test:rules`).
 * Tabby's HTTP calls are mocked; everything else (transactions, stock, locks) is real.
 */
const tabby = vi.hoisted(() => ({
  payment: null as TabbyPayment | null,
  captures: 0,
  refunds: [] as number[],
  refundFails: false,
}));

vi.mock("@/lib/payments/tabby", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/payments/tabby")>();
  return {
    ...real,
    getTabbyPayment: vi.fn(async () => tabby.payment!),
    captureTabbyPayment: vi.fn(async () => {
      tabby.captures++;
      await new Promise((r) => setTimeout(r, 300)); // slow provider widens the race window
      tabby.payment = { ...tabby.payment!, status: "CLOSED", captures: [{ amount: tabby.payment!.amount }] };
      return tabby.payment;
    }),
    refundTabbyPayment: vi.fn(async (_id: string, amount: number) => {
      if (tabby.refundFails) throw new Error("Tabby 400");
      tabby.refunds.push(amount);
      return tabby.payment!;
    }),
  };
});

const { adminDb } = await import("@/lib/firebase/admin");
const { createPendingOrder, markOrderFailed, markOrderPaid, settleTabby } = await import("@/lib/server/orders");
const { refundOrder } = await import("@/lib/server/refunds");
const { setReviewHidden, upsertReview } = await import("@/lib/server/reviews");

const customer = { firstName: "Sara", lastName: "A", email: "s@a.sa", phone: "0551234567", city: "Riyadh", line1: "King Fahd Rd" };
const stockOf = async (id: string) => (await adminDb().collection("products").doc(id).get()).data()!.stock as number;
const order = (quantity: number, productId = "p1") =>
  createPendingOrder({ customerId: "alice", customer, items: [{ productId, quantity }], provider: "tabby", splitAs: "tabby" });

beforeEach(async () => {
  const db = adminDb();
  const existing = await db.collection("orders").get();
  await Promise.all(existing.docs.map((d) => d.ref.delete()));
  await db.recursiveDelete(db.collection("products").doc("p1")); // also clears its reviews
  await db.collection("merchants").doc("m1").set({ storeName: "Store", slug: "store", status: "approved" });
  await db.collection("merchants").doc("m2").set({ storeName: "Paused", slug: "paused", status: "suspended" });
  await db.collection("products").doc("p1").set({ merchantId: "m1", title: "Lamp", price: 250, stock: 2, status: "active", images: [] });
  await db.collection("products").doc("p2").set({ merchantId: "m2", title: "Mug", price: 50, stock: 9, status: "active", images: [] });
  tabby.captures = 0;
  tabby.refunds = [];
  tabby.refundFails = false;
});

describe("stock reservation (review finding: overselling)", () => {
  it("reserves stock at checkout and refuses to oversell", async () => {
    await order(2);
    expect(await stockOf("p1")).toBe(0);
    await expect(order(1)).rejects.toThrow(/sold out/);
  });

  it("merges duplicate lines before checking stock", async () => {
    await expect(
      createPendingOrder({
        customerId: "alice",
        customer,
        items: [
          { productId: "p1", quantity: 2 },
          { productId: "p1", quantity: 2 },
        ],
        provider: "tabby",
        splitAs: "tabby",
      }),
    ).rejects.toThrow(/Only 2 left/);
  });

  it("releases stock exactly once when payment fails", async () => {
    const o = await order(2);
    await markOrderFailed(o.id, "failed");
    await markOrderFailed(o.id, "failed");
    expect(await stockOf("p1")).toBe(2);
  });

  it("re-takes stock if a released order is paid late, and flags oversell", async () => {
    const o = await order(2);
    await markOrderFailed(o.id, "failed");
    await order(2); // someone else bought them
    await markOrderPaid(o.id);
    const saved = (await adminDb().collection("orders").doc(o.id).get()).data()!;
    expect(saved.paymentStatus).toBe("captured");
    expect(saved.oversold).toBe(true);
  });

  it("rejects products of suspended stores", async () => {
    await expect(order(1, "p2")).rejects.toThrow(/not accepting orders/);
  });
});

describe("settlement (review finding: return URL + webhook double capture)", () => {
  it("captures once when both arrive together, and both report captured", async () => {
    const o = await order(1);
    tabby.payment = { id: "pay_1", status: "AUTHORIZED", amount: "250.00", currency: "SAR", order: { reference_id: o.id } };
    const [a, b] = await Promise.all([settleTabby(o.id, "pay_1"), settleTabby(o.id, "pay_1")]);
    expect(tabby.captures).toBe(1);
    expect([a, b]).toEqual(["captured", "captured"]);
    expect(await stockOf("p1")).toBe(1);
  });

  it("marks a mismatched amount as failed without capturing", async () => {
    const o = await order(1);
    tabby.payment = { id: "pay_2", status: "AUTHORIZED", amount: "1.00", currency: "SAR", order: { reference_id: o.id } };
    expect(await settleTabby(o.id, "pay_2")).toBe("failed");
    expect(tabby.captures).toBe(0);
    expect(await stockOf("p1")).toBe(2);
  });
});

describe("refunds", () => {
  const paidOrder = async () => {
    const o = await order(1);
    tabby.payment = { id: "pay_r", status: "AUTHORIZED", amount: "250.00", currency: "SAR", order: { reference_id: o.id } };
    await settleTabby(o.id, "pay_r");
    return o;
  };
  const rowOf = async (orderId: string) => (await adminDb().collection("merchantOrders").doc(`${orderId}_m1`).get()).data()!;
  const orderOf = async (orderId: string) => (await adminDb().collection("orders").doc(orderId).get()).data()!;

  it("records VAT on the order (prices are VAT-inclusive)", async () => {
    const o = await order(1);
    expect(o.total).toBe(250);
    expect(o.vatAmount).toBe(32.61);
  });

  it("refunds through the provider once, restores stock and blocks a second refund", async () => {
    const o = await paidOrder();
    expect(await stockOf("p1")).toBe(1);
    const result = await refundOrder({ orderId: o.id, reason: "Customer returned it", actorUid: "admin" });
    expect(result.amount).toBe(250);
    expect(tabby.refunds).toEqual([250]);
    expect((await orderOf(o.id)).paymentStatus).toBe("refunded");
    expect((await rowOf(o.id)).paymentStatus).toBe("refunded");
    expect(await stockOf("p1")).toBe(2);
    await expect(refundOrder({ orderId: o.id, reason: "again", actorUid: "admin" })).rejects.toThrow(/Only paid orders/);
    expect(tabby.refunds).toEqual([250]);
  });

  it("a late webhook cannot flip a refunded order back to paid", async () => {
    const o = await paidOrder();
    await refundOrder({ orderId: o.id, reason: "Returned", actorUid: "admin" });
    await markOrderPaid(o.id, "pay_r");
    await markOrderFailed(o.id, "failed");
    expect((await orderOf(o.id)).paymentStatus).toBe("refunded");
    expect(await stockOf("p1")).toBe(2);
  });

  it("claws the money back from the next payout when the store was already paid", async () => {
    const o = await paidOrder();
    await adminDb().collection("merchantOrders").doc(`${o.id}_m1`).update({ payoutStatus: "paid" });
    const payoutAmount = (await rowOf(o.id)).payoutAmount as number;
    await refundOrder({ orderId: o.id, reason: "Returned", actorUid: "admin" });
    const adj = (await adminDb().collection("ledgerAdjustments").doc(`refund_${o.id}_m1`).get()).data()!;
    expect(adj).toMatchObject({ merchantId: "m1", amount: -payoutAmount, status: "open" });
  });

  it("changes nothing when the provider rejects the refund, and can be retried", async () => {
    const o = await paidOrder();
    tabby.refundFails = true;
    await expect(refundOrder({ orderId: o.id, reason: "Returned", actorUid: "admin" })).rejects.toThrow(/rejected the refund/);
    expect((await orderOf(o.id)).paymentStatus).toBe("captured");
    expect((await rowOf(o.id)).refundState).toBeUndefined();
    expect(await stockOf("p1")).toBe(1);
    tabby.refundFails = false;
    await refundOrder({ orderId: o.id, reason: "Returned", actorUid: "admin" });
    expect((await orderOf(o.id)).paymentStatus).toBe("refunded");
  });
});
describe("reviews", () => {
  const ratingOf = async () => {
    const p = (await adminDb().collection("products").doc("p1").get()).data()!;
    return { avg: p.ratingAvg, count: p.ratingCount };
  };
  const buy = async (customerId: string) => {
    const o = await createPendingOrder({ customerId, customer, items: [{ productId: "p1", quantity: 1 }], provider: "tabby", splitAs: "tabby" });
    await markOrderPaid(o.id, "sim_1");
  };
  const review = (uid: string, rating: number) => upsertReview({ uid, displayName: uid, productId: "p1", rating, text: "ok" });

  it("only verified buyers can review", async () => {
    await expect(review("stranger", 5)).rejects.toThrow(/bought this product/);
    const o = await order(1); // unpaid order doesn't count either
    await expect(review("alice", 5)).rejects.toThrow(/bought this product/);
    await markOrderPaid(o.id, "sim_1");
    await review("alice", 5);
    expect(await ratingOf()).toEqual({ avg: 5, count: 1 });
  });

  it("keeps one review per buyer and the average in step with edits and moderation", async () => {
    await buy("alice");
    await buy("bob");
    await review("alice", 5);
    await review("bob", 2);
    expect(await ratingOf()).toEqual({ avg: 3.5, count: 2 });
    await review("bob", 4); // edit, not a second review
    expect(await ratingOf()).toEqual({ avg: 4.5, count: 2 });
    await setReviewHidden("p1", "bob", true);
    await setReviewHidden("p1", "bob", true); // idempotent
    expect(await ratingOf()).toEqual({ avg: 5, count: 1 });
    await setReviewHidden("p1", "bob", false);
    expect(await ratingOf()).toEqual({ avg: 4.5, count: 2 });
  });
});