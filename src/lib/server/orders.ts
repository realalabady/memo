import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { computeSplit } from "@/lib/money";
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
import {
  captureTabbyPayment,
  getTabbyPayment,
} from "@/lib/payments/tabby";
import {
  authoriseTamaraOrder,
  captureTamaraOrder,
  getTamaraOrder,
} from "@/lib/payments/tamara";

export async function getSettings(): Promise<PlatformSettings> {
  const snap = await adminDb().collection("settings").doc("platform").get();
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<PlatformSettings> | undefined) };
}

/**
 * Prices are always re-read from Firestore — never trusted from the client.
 * Writes the order plus one merchantOrders ledger row per merchant in the cart.
 */
export async function createPendingOrder(input: {
  customerId: string;
  customer: Address;
  items: { productId: string; quantity: number }[];
  provider: Provider | "demo";
  splitAs: Provider;
}) {
  const db = adminDb();
  const refs = input.items.map((i) => db.collection("products").doc(i.productId));
  const snaps = await db.getAll(...refs);

  const lines: OrderLine[] = snaps.map((s, idx) => {
    if (!s.exists) throw new HttpError(400, "A product in your bag no longer exists");
    const p = { id: s.id, ...s.data() } as Product;
    const qty = input.items[idx].quantity;
    if (p.status !== "active") throw new HttpError(400, `${p.title} is unavailable`);
    if (p.stock < qty) throw new HttpError(400, `Only ${p.stock} left of ${p.title}`);
    return {
      productId: p.id,
      merchantId: p.merchantId,
      title: p.title,
      image: p.images[0],
      unitPrice: p.price,
      quantity: qty,
      total: round2(p.price * qty),
    };
  });

  const merchantIds = [...new Set(lines.map((l) => l.merchantId))];
  const merchantSnaps = await db.getAll(...merchantIds.map((id) => db.collection("merchants").doc(id)));
  const merchants = new Map(
    merchantSnaps.map((s) => [s.id, { id: s.id, ...s.data() } as Merchant]),
  );
  for (const id of merchantIds) {
    if (merchants.get(id)?.status !== "approved") {
      throw new HttpError(400, "One of the stores in your bag is not accepting orders");
    }
  }

  const settings = await getSettings();
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const orderRef = db.collection("orders").doc();
  const now = Date.now();

  const order: Order = {
    id: orderRef.id,
    customerId: input.customerId,
    customer: input.customer,
    items: lines,
    merchantIds,
    subtotal,
    total: subtotal,
    currency: "SAR",
    provider: input.provider,
    paymentStatus: "pending",
    createdAt: now,
  };

  const batch = db.batch();
  batch.set(orderRef, order);
  for (const merchantId of merchantIds) {
    const merchant = merchants.get(merchantId)!;
    const mLines = lines.filter((l) => l.merchantId === merchantId);
    const mSubtotal = round2(mLines.reduce((s, l) => s + l.total, 0));
    const split = computeSplit(mSubtotal, input.splitAs, settings, merchant.commissionRate);
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
    batch.set(db.collection("merchantOrders").doc(row.id), row);
  }
  await batch.commit();
  return order;
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

/** Idempotent: flips order + ledger rows to captured and decrements stock once. */
export async function markOrderPaid(orderId: string, providerPaymentId?: string) {
  const db = adminDb();
  await db.runTransaction(async (tx) => {
    const ref = db.collection("orders").doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`Order ${orderId} not found`);
    const order = snap.data() as Order;
    if (order.paymentStatus === "captured") return;
    const now = Date.now();
    tx.update(ref, {
      paymentStatus: "captured",
      paidAt: now,
      ...(providerPaymentId ? { providerPaymentId } : {}),
    });
    for (const merchantId of order.merchantIds) {
      tx.update(db.collection("merchantOrders").doc(`${orderId}_${merchantId}`), {
        paymentStatus: "captured",
        paidAt: now,
      });
    }
    for (const line of order.items) {
      tx.update(db.collection("products").doc(line.productId), {
        stock: FieldValue.increment(-line.quantity),
      });
    }
  });
}

export async function markOrderFailed(orderId: string, status: "failed" | "cancelled", reason?: string) {
  const db = adminDb();
  await db.runTransaction(async (tx) => {
    const ref = db.collection("orders").doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const order = snap.data() as Order;
    if (order.paymentStatus === "captured") return;
    tx.update(ref, { paymentStatus: status, failureReason: reason ?? null });
    for (const merchantId of order.merchantIds) {
      tx.update(db.collection("merchantOrders").doc(`${orderId}_${merchantId}`), {
        paymentStatus: status,
      });
    }
  });
}

const sameAmount = (a: number | string, b: number) => Math.abs(Number(a) - b) < 0.01;

/** Verify with Tabby, capture if needed, then record. Safe to call from both return URL and webhook. */
export async function settleTabby(orderId: string, paymentId: string) {
  const order = await getOrder(orderId);
  if (!order) throw new Error("Order not found");
  if (order.paymentStatus === "captured") return "captured" as const;
  const payment = await getTabbyPayment(paymentId);
  if (payment.order.reference_id !== orderId || !sameAmount(payment.amount, order.total)) {
    await markOrderFailed(orderId, "failed", "Payment mismatch");
    return "failed" as const;
  }
  if (payment.status === "AUTHORIZED") {
    await captureTabbyPayment(paymentId, order.total, orderId);
  } else if (payment.status !== "CLOSED") {
    await markOrderFailed(orderId, "failed", `Tabby status ${payment.status}`);
    return "failed" as const;
  }
  await markOrderPaid(orderId, paymentId);
  return "captured" as const;
}

/** Verify with Tamara, authorise + capture if needed, then record. */
export async function settleTamara(orderId: string, tamaraOrderId: string) {
  const order = await getOrder(orderId);
  if (!order) throw new Error("Order not found");
  if (order.paymentStatus === "captured") return "captured" as const;
  let remote = await getTamaraOrder(tamaraOrderId);
  if (remote.order_reference_id !== orderId || !sameAmount(remote.total_amount.amount, order.total)) {
    await markOrderFailed(orderId, "failed", "Payment mismatch");
    return "failed" as const;
  }
  const status = remote.status.toLowerCase();
  if (status === "approved") {
    await authoriseTamaraOrder(tamaraOrderId);
    remote = { ...remote, status: "authorised" };
  }
  if (remote.status.toLowerCase() === "authorised") {
    await captureTamaraOrder(tamaraOrderId, order.total);
  } else if (!["fully_captured", "partially_captured"].includes(remote.status.toLowerCase())) {
    await markOrderFailed(orderId, "failed", `Tamara status ${remote.status}`);
    return "failed" as const;
  }
  await markOrderPaid(orderId, tamaraOrderId);
  return "captured" as const;
}
