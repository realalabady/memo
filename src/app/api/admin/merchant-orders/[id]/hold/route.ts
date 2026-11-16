import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/merchant";
import type { MerchantOrder } from "@/lib/types";

const schema = z.object({ hold: z.boolean(), note: z.string().trim().max(200).optional() });

/** Admin: keep one store's order out of payouts while a dispute is open, or release it again. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/merchant-orders/[id]/hold">) {
  try {
    const { id } = await ctx.params;
    const admin = await requireUser(req, ["admin"]);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Invalid request");
    const { hold, note } = parsed.data;

    const db = adminDb();
    const ref = db.collection("merchantOrders").doc(id);
    await db.runTransaction(async (tx) => {
      const row = (await tx.get(ref)).data() as MerchantOrder | undefined;
      if (!row) throw new HttpError(404, "Order not found");
      if (row.payoutStatus === "paid") throw new HttpError(409, "This order is already paid out");
      tx.update(ref, { payoutStatus: hold ? "on_hold" : "unpaid", holdNote: hold ? (note ?? "") : null });
    });
    await audit(admin.uid, hold ? "payout.hold" : "payout.release", `merchantOrders/${id}`, { note: note ?? null });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
