import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { getOrder } from "@/lib/server/orders";
import type { MerchantOrder } from "@/lib/types";

/**
 * One order for its customer (or an admin): payment status plus, per store, what was bought,
 * the delivery status and tracking number. Commission and payout figures are never included.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser(req);
    const order = await getOrder(id);
    if (!order || (order.customerId !== user.uid && user.role !== "admin")) throw new HttpError(404, "Order not found");

    const db = adminDb();
    const rows = await db.getAll(...order.merchantIds.map((m) => db.collection("merchantOrders").doc(`${order.id}_${m}`)));
    const parcels = rows
      .map((s) => s.data() as MerchantOrder | undefined)
      .filter((r) => r !== undefined)
      .map((r) => ({
        merchantId: r.merchantId,
        merchantName: r.merchantName,
        items: r.items,
        subtotal: r.subtotal,
        paymentStatus: r.paymentStatus,
        fulfillmentStatus: r.fulfillmentStatus,
        trackingNumber: r.trackingNumber ?? null,
        shippedAt: r.shippedAt ?? null,
        deliveredAt: r.deliveredAt ?? null,
      }));

    return Response.json({
      id: order.id,
      paymentStatus: order.paymentStatus,
      total: order.total,
      vatAmount: order.vatAmount ?? null,
      refundedAmount: order.refundedAmount ?? 0,
      provider: order.provider,
      createdAt: order.createdAt,
      paidAt: order.paidAt ?? null,
      customer: order.customer,
      parcels,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
