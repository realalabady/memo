import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { getOrder } from "@/lib/server/orders";

/** The real payment status of one order, for the checkout result page (owner or admin only). */
export async function GET(req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser(req);
    const order = await getOrder(id);
    if (!order || (order.customerId !== user.uid && user.role !== "admin")) throw new HttpError(404, "Order not found");
    return Response.json({
      id: order.id,
      paymentStatus: order.paymentStatus,
      total: order.total,
      provider: order.provider,
      createdAt: order.createdAt,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
