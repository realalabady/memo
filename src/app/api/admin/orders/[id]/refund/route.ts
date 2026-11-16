import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { revalidateCatalog } from "@/lib/server/merchant";
import { refundOrder } from "@/lib/server/refunds";

const schema = z.object({
  /** One store's part of the order (`{orderId}_{merchantId}`); omit to refund the whole order */
  merchantOrderIds: z.array(z.string().min(1)).min(1).max(50).optional(),
  reason: z.string().trim().min(3, "Give a short reason for the refund").max(200),
});

/** Admin: refund a paid order (or one store's part of it) through Tabby/Tamara. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/orders/[id]/refund">) {
  try {
    const { id } = await ctx.params;
    const admin = await requireUser(req, ["admin"]);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid refund");
    const result = await refundOrder({ orderId: id, ...parsed.data, actorUid: admin.uid });
    revalidateCatalog(); // stock went back on the shelf
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
