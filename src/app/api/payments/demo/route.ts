import { z } from "zod";
import { isAdminConfigured } from "@/lib/firebase/admin";
import { shouldSimulate } from "@/lib/payments";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { getOrder, markOrderFailed, markOrderPaid } from "@/lib/server/orders";

const schema = z.object({ orderId: z.string(), approve: z.boolean() });

/** Payment simulator — only active when shouldSimulate() allows it. */
export async function POST(req: Request) {
  try {
    const { orderId, approve } = schema.parse(await req.json());
    if (!isAdminConfigured || orderId === "demo") {
      return Response.json({ status: approve ? "captured" : "cancelled" });
    }
    const user = await requireUser(req);
    const order = await getOrder(orderId);
    if (!order || order.customerId !== user.uid) throw new HttpError(404, "Order not found");
    if (order.provider === "demo" || !shouldSimulate(order.provider)) {
      throw new HttpError(403, "Simulator disabled for this provider");
    }
    if (approve) await markOrderPaid(orderId, `sim_${Date.now()}`);
    else await markOrderFailed(orderId, "cancelled", "Cancelled in simulator");
    return Response.json({ status: approve ? "captured" : "cancelled" });
  } catch (err) {
    return errorResponse(err);
  }
}
