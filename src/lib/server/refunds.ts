import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { refundTabbyPayment } from "@/lib/payments/tabby";
import { refundTamaraOrder } from "@/lib/payments/tamara";
import type { LedgerAdjustment, MerchantOrder, Order } from "@/lib/types";
import { round2 } from "@/lib/utils";
import { HttpError } from "./auth";
import { audit } from "./merchant";

/**
 * Refunds are per store: each merchantOrders row (one store's part of an order) is refunded in full.
 *
 *  1. claim    — transaction marks the rows `refundState: "pending"` (blocks double clicks and double refunds)
 *  2. provider — Tabby/Tamara sends the money back
 *  3. finalize — transaction marks rows refunded, restores stock, and if the store was already
 *                paid for a row, writes a negative ledgerAdjustment netted into its next payout
 *
 * If step 2 fails the claim is released. If step 3 fails after the provider succeeded the rows stay
 * "pending" (so nobody can refund twice) and the failure is audited for manual follow-up.
 */
export async function refundOrder(input: {
  orderId: string;
  /** Rows to refund; omit for the whole order */
  merchantOrderIds?: string[];
  reason: string;
  actorUid: string;
}) {
  const db = adminDb();
  const orderRef = db.collection("orders").doc(input.orderId);

  // 1. claim
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpError(404, "Order not found");
    const order = { id: snap.id, ...snap.data() } as Order;
    if (order.paymentStatus !== "captured") throw new HttpError(409, "Only paid orders can be refunded");

    const ids = [...new Set(input.merchantOrderIds ?? order.merchantIds.map((m) => `${order.id}_${m}`))];
    if (!ids.length) throw new HttpError(400, "Nothing to refund");
    const rowSnaps = await tx.getAll(...ids.map((id) => db.collection("merchantOrders").doc(id)));
    const rows = rowSnaps.map((s) => {
      const row = s.data() as MerchantOrder | undefined;
      if (!row || row.orderId !== order.id) throw new HttpError(400, "That item isn't part of this order");
      if (row.refundState === "pending") throw new HttpError(409, "A refund for this order is already in progress — check the provider dashboard before retrying");
      if (row.paymentStatus !== "captured") throw new HttpError(409, "This part of the order is already refunded");
      return row;
    });
    for (const s of rowSnaps) tx.update(s.ref, { refundState: "pending" });
    return { order, rows, amount: round2(rows.reduce((sum, r) => sum + r.subtotal, 0)) };
  });

  const rowRefs = claim.rows.map((r) => db.collection("merchantOrders").doc(r.id));

  // 2. provider
  let providerRefundId: string | null = null;
  try {
    providerRefundId = await sendProviderRefund(claim.order, claim.amount, input.reason);
  } catch (err) {
    const batch = db.batch();
    for (const ref of rowRefs) batch.update(ref, { refundState: FieldValue.delete() });
    await batch.commit();
    console.error("refund provider call failed", err);
    throw new HttpError(502, "The payment provider rejected the refund. Nothing was changed.");
  }

  // 3. finalize
  try {
    await applyRefund({
      orderId: claim.order.id,
      merchantOrderIds: claim.rows.map((r) => r.id),
      reason: input.reason,
    });
  } catch (err) {
    await audit(input.actorUid, "refund.finalize_failed", `orders/${claim.order.id}`, {
      amount: claim.amount,
      providerRefundId,
      error: String(err),
    });
    throw new HttpError(500, "The refund was sent, but recording it failed. Do not retry — contact support.");
  }

  await audit(input.actorUid, "refund.completed", `orders/${claim.order.id}`, {
    amount: claim.amount,
    merchantOrderIds: claim.rows.map((r) => r.id),
    reason: input.reason,
    providerRefundId,
  });
  return { amount: claim.amount, rows: claim.rows.length };
}

async function sendProviderRefund(order: Order, amount: number, reason: string) {
  const paymentId = order.providerPaymentId;
  // Simulator / sample orders never touched a provider.
  if (order.provider === "demo" || !paymentId || paymentId.startsWith("sim_")) return null;
  if (order.provider === "tabby") {
    // The reference is stable per order + amount already refunded, so a retried request is not a second refund.
    const reference = `${order.id}-r${Math.round((order.refundedAmount ?? 0) * 100)}`;
    const payment = await refundTabbyPayment(paymentId, amount, reference, reason);
    return payment.id;
  }
  const res = await refundTamaraOrder(paymentId, amount, reason);
  return res.refund_id ?? res.order_id;
}

/**
 * Records a refund that has ALREADY happened at the provider (called after our own refund call,
 * or from a webhook when the refund was made in the provider's dashboard). Idempotent per row.
 */
export async function applyRefund(input: { orderId: string; merchantOrderIds?: string[]; reason: string }) {
  const db = adminDb();
  const orderRef = db.collection("orders").doc(input.orderId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) return { refunded: 0 };
    const order = { id: snap.id, ...snap.data() } as Order;

    const allIds = order.merchantIds.map((m) => `${order.id}_${m}`);
    const allSnaps = await tx.getAll(...allIds.map((id) => db.collection("merchantOrders").doc(id)));
    const wanted = new Set(input.merchantOrderIds ?? allIds);
    const targets = allSnaps.filter((s) => {
      const row = s.data() as MerchantOrder | undefined;
      return row && wanted.has(s.id) && row.paymentStatus === "captured";
    });
    if (!targets.length) return { refunded: 0 };

    const lines = targets.flatMap((s) => (s.data() as MerchantOrder).items);
    const productSnaps = await tx.getAll(...lines.map((l) => db.collection("products").doc(l.productId)));

    const now = Date.now();
    let amount = 0;
    for (const s of targets) {
      const row = s.data() as MerchantOrder;
      amount += row.subtotal;
      tx.update(s.ref, {
        paymentStatus: "refunded",
        refundState: "done",
        refundedAt: now,
        refundReason: input.reason,
      });
      if (row.payoutStatus === "paid") {
        // The store already received this money: take it back from its next payout.
        const adjRef = db.collection("ledgerAdjustments").doc(`refund_${row.id}`);
        const adjustment: LedgerAdjustment = {
          id: adjRef.id,
          merchantId: row.merchantId,
          merchantOrderId: row.id,
          orderId: order.id,
          amount: -row.payoutAmount,
          reason: `Refund of order ${order.id}`,
          status: "open",
          createdAt: now,
        };
        tx.set(adjRef, adjustment);
      }
    }
    // Refunded goods go back on the shelf.
    productSnaps.forEach((p, idx) => {
      if (p.exists) tx.update(p.ref, { stock: FieldValue.increment(lines[idx].quantity) });
    });

    const refundedAmount = round2((order.refundedAmount ?? 0) + amount);
    const everyRowRefunded = allSnaps.every(
      (s) => targets.some((t) => t.id === s.id) || (s.data() as MerchantOrder | undefined)?.paymentStatus === "refunded",
    );
    tx.update(orderRef, {
      refundedAmount,
      ...(everyRowRefunded ? { paymentStatus: "refunded", refundedAt: now } : {}),
    });
    return { refunded: targets.length, amount: round2(amount) };
  });
}

/**
 * True while one of our own refunds is between "sent to provider" and "recorded".
 * Webhooks wait (return an error so the provider retries) instead of recording it a second way.
 */
export async function refundInProgress(order: Order) {
  const db = adminDb();
  const rows = await db.getAll(...order.merchantIds.map((m) => db.collection("merchantOrders").doc(`${order.id}_${m}`)));
  return rows.some((s) => (s.data() as MerchantOrder | undefined)?.refundState === "pending");
}

/** Flag an order the admin should look at (e.g. a partial refund made in the provider's dashboard). */
export async function flagForReview(orderId: string, note: string) {
  await adminDb().collection("orders").doc(orderId).update({ needsReview: note }).catch(() => {});
}
