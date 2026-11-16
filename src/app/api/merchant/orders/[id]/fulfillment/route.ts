import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError } from "@/lib/server/auth";
import { requireApprovedMerchant } from "@/lib/server/merchant";
import type { FulfillmentStatus, MerchantOrder } from "@/lib/types";

const schema = z.object({
  status: z.enum(["shipped", "delivered"]),
  trackingNumber: z.string().trim().max(60).optional(),
});

const rank: Record<FulfillmentStatus, number> = { pending: 0, shipped: 1, delivered: 2 };

/** Move a paid order forward (pending → shipped → delivered). Never backwards, never before payment. */
export async function POST(req: Request, ctx: RouteContext<"/api/merchant/orders/[id]/fulfillment">) {
  try {
    const { id } = await ctx.params;
    const { user } = await requireApprovedMerchant(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Invalid status");
    const { status, trackingNumber } = parsed.data;

    const db = adminDb();
    const ref = db.collection("merchantOrders").doc(id);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const row = snap.data() as MerchantOrder | undefined;
      if (!row || row.merchantId !== user.uid) throw new HttpError(404, "Order not found");
      if (row.paymentStatus !== "captured") throw new HttpError(409, "This order isn't paid");
      if (rank[status] <= rank[row.fulfillmentStatus]) throw new HttpError(409, `Order is already ${row.fulfillmentStatus}`);
      tx.update(ref, {
        fulfillmentStatus: status,
        ...(trackingNumber ? { trackingNumber } : {}),
        [`${status}At`]: Date.now(),
        updatedAt: Date.now(),
      });
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
