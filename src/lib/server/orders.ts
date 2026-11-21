import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { computeSplit, vatIncluded } from "@/lib/money";
import {
  DEFAULT_SETTINGS,
  type Address,
  type Merchant,
  type MerchantOrder,
  type Order,
  type OrderLine,
  type PlatformSettings,
  type Product,
  type Provider,
} from "@/lib/types";
import { round2 } from "@/lib/utils";
import { HttpError } from "./auth";
import { stockChanged } from "./merchant";
import { captureTabbyPayment, getTabbyPayment, tabbyPaymentIsPaid } from "@/lib/payments/tabby";
import { authoriseTamaraOrder, captureTamaraOrder, getTamaraOrder } from "@/lib/payments/tamara";

/** How long a checkout holds stock before the cron releases it. */
export const RESERVATION_MS = 30 * 60 * 1000;
/** How long one caller may hold the settlement lock. */
const SETTLE_LEASE_MS = 60 * 1000;

export type SettleResult = "captured" | "failed" | "pending";

export async function getSettings(): Promise<PlatformSettings> {
  const snap = await adminDb().collection("settings").doc("platform").get();
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<PlatformSettings> | undefined) };
}

/** Sum quantities of repeated product ids so one line can't bypass the stock check. */
export function mergeItems(items: { productId: string; quantity: number }[]) {
  const map = new Map<string, number>();
  for (const i of items) map.set(i.productId, (map.get(i.productId) ?? 0) + i.quantity);
  return [...map].map(([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Prices are always re-read from Firestore — never trusted from the client.
 * In ONE transaction: validates products + stores, reserves stock, and writes the order
 * plus one merchantOrders ledger row per store. Stock is released if the payment fails or expires.
 */
export async function createPendingOrder(input: {
  customerId: string;
  customer: Address;
  items: { productId: string; quantity: number }[];
  provider: Provider | "demo";
  splitAs: Provider;
}) {
  const db = adminDb();
  const items = mergeItems(input.items);
  if (items.some((i) => i.quantity > 50)) throw new HttpError(400, "That's more than we can sell in one order");
  const settings = await getSettings();
  const orderRef = db.collection("orders").doc();

  const created = await db.runTransaction(async (tx) => {
    const snaps = await tx.getAll(...items.map((i) => db.collection("products").doc(i.productId)));
    const lines: OrderLine[] = snaps.map((s, idx) => {
      if (!s.exists) throw new HttpError(400, "A product in your bag no longer exists");
      const p = { id: s.id, ...s.data() } as Product;
      const qty = items[idx].quantity;
      if (p.status !== "active") throw new HttpError(400, `${p.title} is unavailable`);
      if (typeof p.price !== "number" || !(p.price > 0)) throw new HttpError(400, `${p.title} is unavailable`);
      if (!Number.isInteger(p.stock) || p.stock < qty) {
        throw new HttpError(400, p.stock > 0 ? `Only ${p.stock} left of ${p.title}` : `${p.title} is sold out`);
      }
      return {
        productId: p.id,
        merchantId: p.merchantId,
        title: p.title,
        ...(p.titleAr ? { titleAr: p.titleAr } : {}),
        // Firestore rejects undefined values — omit the field for image-less products.
        ...(p.images?.[0] ? { image: p.images[0] } : {}),
        unitPrice: p.price,
        quantity: qty,
        total: round2(p.price * qty),
      };
    });

    const merchantIds = [...new Set(lines.map((l) => l.merchantId))];
    const merchantSnaps = await tx.getAll(...merchantIds.map((id) => db.collection("merchants").doc(id)));
    const merchants = new Map(merchantSnaps.map((s) => [s.id, { id: s.id, ...s.data() } as Merchant]));
    for (const id of merchantIds) {
      if (merchants.get(id)?.status !== "approved") {
        throw new HttpError(400, "One of the stores in your bag is not accepting orders");
      }
    }

    const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
    const now = Date.now();
    const order: Order = {
      id: orderRef.id,
      customerId: input.customerId,
      customer: input.customer,
      items: lines,
      merchantIds,
      subtotal,
      total: subtotal,
      vatAmount: vatIncluded(subtotal, settings.vatRate),
      currency: "SAR",
      provider: input.provider,
      paymentStatus: "pending",
      stockReserved: true,
      reservedUntil: now + RESERVATION_MS,
      createdAt: now,
    };

    // Writes after all reads (Firestore transaction rule).
    snaps.forEach((s, idx) => tx.update(s.ref, { stock: FieldValue.increment(-items[idx].quantity) }));
    tx.set(orderRef, order);
    for (const merchantId of merchantIds) {
      const merchant = merchants.get(merchantId)!;
      const mLines = lines.filter((l) => l.merchantId === merchantId);
      const mSubtotal = round2(mLines.reduce((s, l) => s + l.total, 0));
      const split = computeSplit(mSubtotal, input.splitAs, settings, merchant.commissionRate ?? undefined);
      const row: MerchantOrder = {
        id: `${orderRef.id}_${merchantId}`,
        orderId: orderRef.id,
        merchantId,
        merchantName: merchant.storeName,
        customerId: input.customerId,
        customer: input.customer,
        items: mLines,
        provider: input.provider,
        ...split,
        paymentStatus: "pending",
        fulfillmentStatus: "pending",
        payoutStatus: "unpaid",
        createdAt: now,
      };
      tx.set(db.collection("merchantOrders").doc(row.id), row);
    }
    return order;
  });
  stockChanged();
  return created;
}

export async function getOrder(id: string) {
  const snap = await adminDb().collection("orders").doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Order) : null;
}

export async function saveProviderRefs(orderId: string, refs: { checkoutId?: string; paymentId?: string }) {
  await adminDb()
    .collection("orders")
    .doc(orderId)
    .update({
      ...(refs.checkoutId ? { providerCheckoutId: refs.checkoutId } : {}),
      ...(refs.paymentId ? { providerPaymentId: refs.paymentId } : {}),
    });
}

/**
 * Idempotent: flips order + ledger rows to captured. Stock was reserved at checkout; if the
 * reservation was already released (late webhook after expiry), stock is taken again and the
 * order is flagged `oversold` when that drives stock below zero, so the admin can follow up.
 */
export async function markOrderPaid(orderId: string, providerPaymentId?: string) {
  const db = adminDb();
  const tookStock = await db.runTransaction(async (tx) => {
    const ref = db.collection("orders").doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`Order ${orderId} not found`);
    const order = snap.data() as Order;
    // Refunded is final: a late webhook must never flip it back to paid.
    if (order.paymentStatus === "captured" || order.paymentStatus === "refunded") return false;

    const productSnaps = order.stockReserved
      ? []
      : await tx.getAll(...order.items.map((l) => db.collection("products").doc(l.productId)));
    const now = Date.now();
    let oversold = false;
    productSnaps.forEach((p, idx) => {
      if (!p.exists) return; // product removed since — nothing to decrement
      const qty = order.items[idx].quantity;
      if (((p.data() as Product).stock ?? 0) < qty) oversold = true;
      tx.update(p.ref, { stock: FieldValue.increment(-qty) });
    });

    tx.update(ref, {
      paymentStatus: "captured",
      paidAt: now,
      stockReserved: true,
      ...(oversold ? { oversold: true } : {}),
      ...(providerPaymentId ? { providerPaymentId } : {}),
    });
    for (const merchantId of order.merchantIds) {
      tx.update(db.collection("merchantOrders").doc(`${orderId}_${merchantId}`), {
        paymentStatus: "captured",
        paidAt: now,
      });
    }
    return productSnaps.length > 0;
  });
  if (tookStock) stockChanged();
}

/** Marks a not-yet-paid order failed/cancelled and releases its reserved stock (once). */
export async function markOrderFailed(orderId: string, status: "failed" | "cancelled", reason?: string) {
  const db = adminDb();
  const released = await db.runTransaction(async (tx) => {
    const ref = db.collection("orders").doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const order = snap.data() as Order;
    if (order.paymentStatus === "captured" || order.paymentStatus === "refunded") return false;

    const productSnaps = order.stockReserved
      ? await tx.getAll(...order.items.map((l) => db.collection("products").doc(l.productId)))
      : [];
    productSnaps.forEach((p, idx) => {
      if (p.exists) tx.update(p.ref, { stock: FieldValue.increment(order.items[idx].quantity) });
    });

    tx.update(ref, { paymentStatus: status, failureReason: reason ?? null, stockReserved: false });
    for (const merchantId of order.merchantIds) {
      tx.update(db.collection("merchantOrders").doc(`${orderId}_${merchantId}`), { paymentStatus: status });
    }
    return productSnaps.length > 0;
  });
  if (released) stockChanged();
}

/**
 * Return URL and webhook can arrive at the same moment. Only one caller may talk to the
 * provider at a time; the other waits briefly for the result instead of capturing twice.
 */
async function withSettlementLock(orderId: string, work: (order: Order) => Promise<SettleResult>): Promise<SettleResult> {
  const db = adminDb();
  const ref = db.collection("orders").doc(orderId);
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Order not found");
    const order = { id: snap.id, ...snap.data() } as Order;
    if (order.paymentStatus === "captured") return { state: "captured" as const };
    if (order.paymentStatus === "refunded") return { state: "refunded" as const };
    if ((order.settleLockUntil ?? 0) > Date.now()) return { state: "busy" as const };
    tx.update(ref, { settleLockUntil: Date.now() + SETTLE_LEASE_MS });
    return { state: "claimed" as const, order };
  });

  if (claim.state === "captured") return "captured";
  if (claim.state === "refunded") return "failed";
  if (claim.state === "busy") {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const o = await getOrder(orderId);
      if (o?.paymentStatus === "captured") return "captured";
      if (o && o.paymentStatus !== "pending") return "failed";
    }
    return "pending";
  }
  try {
    return await work(claim.order);
  } finally {
    await ref.update({ settleLockUntil: 0 }).catch(() => {});
  }
}

const sameAmount = (a: number | string, b: number) => Math.abs(Number(a) - b) < 0.01;

/** Verify with Tabby, capture if needed, then record. Safe to call from return URL, webhook and cron. */
export function settleTabby(orderId: string, paymentId: string) {
  return withSettlementLock(orderId, async (order) => {
    const payment = await getTabbyPayment(paymentId);
    if (payment.order?.reference_id !== orderId || payment.currency !== "SAR" || !sameAmount(payment.amount, order.total)) {
      await markOrderFailed(orderId, "failed", "Payment mismatch");
      return "failed";
    }
    if (payment.status === "AUTHORIZED") {
      try {
        await captureTabbyPayment(paymentId, order.total, orderId);
      } catch (err) {
        // Another process may have captured already — trust the provider's current state.
        if (!tabbyPaymentIsPaid(await getTabbyPayment(paymentId), order.total)) throw err;
      }
    } else if (!tabbyPaymentIsPaid(payment, order.total)) {
      if (payment.status === "CREATED") return "pending"; // shopper hasn't finished yet
      await markOrderFailed(orderId, "failed", `Tabby status ${payment.status}`);
      return "failed";
    }
    await markOrderPaid(orderId, paymentId);
    return "captured";
  });
}

/** Verify with Tamara, authorise + capture if needed, then record. */
export function settleTamara(orderId: string, tamaraOrderId: string) {
  return withSettlementLock(orderId, async (order) => {
    const remote = await getTamaraOrder(tamaraOrderId);
    if (
      remote.order_reference_id !== orderId ||
      (remote.total_amount.currency ?? "SAR") !== "SAR" ||
      !sameAmount(remote.total_amount.amount, order.total)
    ) {
      await markOrderFailed(orderId, "failed", "Payment mismatch");
      return "failed";
    }
    let status = remote.status.toLowerCase();
    if (status === "approved") {
      await authoriseTamaraOrder(tamaraOrderId).catch(async (err) => {
        const again = (await getTamaraOrder(tamaraOrderId)).status.toLowerCase();
        if (again === "approved" || again === "new") throw err;
      });
      status = (await getTamaraOrder(tamaraOrderId)).status.toLowerCase();
    }
    if (status === "authorised") {
      try {
        await captureTamaraOrder(tamaraOrderId, order.total);
      } catch (err) {
        if ((await getTamaraOrder(tamaraOrderId)).status.toLowerCase() !== "fully_captured") throw err;
      }
    } else if (status !== "fully_captured") {
      if (status === "new") return "pending";
      await markOrderFailed(orderId, "failed", `Tamara status ${remote.status}`);
      return "failed";
    }
    await markOrderPaid(orderId, tamaraOrderId);
    return "captured";
  });
}

/** Used by the expiry cron: ask the provider first, then release stock if still unpaid. */
export async function settleOrExpire(order: Order): Promise<SettleResult> {
  let result: SettleResult = "pending";
  try {
    if (order.provider === "tabby" && order.providerPaymentId) result = await settleTabby(order.id, order.providerPaymentId);
    if (order.provider === "tamara" && order.providerPaymentId) result = await settleTamara(order.id, order.providerPaymentId);
  } catch (err) {
    console.error(`settleOrExpire ${order.id}`, err);
    return "pending"; // provider unreachable — try again next run
  }
  if (result === "pending") {
    await markOrderFailed(order.id, "failed", "Checkout expired");
    return "failed";
  }
  return result;
}
