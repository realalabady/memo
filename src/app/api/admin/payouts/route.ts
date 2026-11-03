import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import type { Merchant, MerchantOrder, Payout } from "@/lib/types";
import { round2 } from "@/lib/utils";

const schema = z.object({
  merchantId: z.string().min(1),
  merchantOrderIds: z.array(z.string()).min(1).max(400),
  reference: z.string().trim().min(2).max(80),
  note: z.string().trim().max(300).optional(),
});

/**
 * Record a bank transfer to a merchant. The amount is computed on the server
 * from the ledger rows, and every row is locked to this payout in one transaction.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireUser(req, ["admin"]);
    const body = schema.safeParse(await req.json());
    if (!body.success) throw new HttpError(400, "Invalid payout");
    const { merchantId, merchantOrderIds, reference, note } = body.data;
    const db = adminDb();

    const payout = await db.runTransaction(async (tx) => {
      const merchantSnap = await tx.get(db.collection("merchants").doc(merchantId));
      if (!merchantSnap.exists) throw new HttpError(404, "Merchant not found");
      const rows = await Promise.all(
        merchantOrderIds.map((id) => tx.get(db.collection("merchantOrders").doc(id))),
      );
      let amount = 0;
      for (const snap of rows) {
        const row = snap.data() as MerchantOrder | undefined;
        if (!row || row.merchantId !== merchantId) throw new HttpError(400, "Order does not belong to merchant");
        if (row.paymentStatus !== "captured") throw new HttpError(400, `Order ${row.orderId} is not paid yet`);
        if (row.payoutStatus !== "unpaid") throw new HttpError(409, `Order ${row.orderId} is already settled`);
        amount += row.payoutAmount;
      }
      const ref = db.collection("payouts").doc();
      const record: Payout = {
        id: ref.id,
        merchantId,
        merchantName: (merchantSnap.data() as Merchant).storeName,
        amount: round2(amount),
        merchantOrderIds,
        reference,
        note: note ?? "",
        createdBy: admin.uid,
        createdAt: Date.now(),
      };
      tx.set(ref, record);
      for (const snap of rows) tx.update(snap.ref, { payoutStatus: "paid", payoutId: ref.id });
      return record;
    });

    return Response.json(payout);
  } catch (err) {
    return errorResponse(err);
  }
}
