import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { payoutEligibility } from "@/lib/money";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/orders";
import type { LedgerAdjustment, Merchant, MerchantOrder, Payout } from "@/lib/types";
import { round2 } from "@/lib/utils";

const schema = z.object({
  merchantId: z.string().min(1),
  merchantOrderIds: z.array(z.string()).min(1).max(400),
  reference: z.string().trim().min(2).max(80),
  note: z.string().trim().max(300).optional(),
});

const blockMessage: Record<string, string> = {
  not_paid: "is not paid",
  settled: "is already settled",
  on_hold: "is on hold",
  not_delivered: "is not delivered yet",
  hold_period: "is still inside the hold period",
};

/**
 * Record a bank transfer to a merchant. The amount is computed on the server from the ledger rows,
 * minus any open refund clawbacks for that merchant, and every row is locked to this payout in one transaction.
 * A row is payable only once it is paid, delivered and past the hold period (settings.payoutHoldDays).
 */
export async function POST(req: Request) {
  try {
    const admin = await requireUser(req, ["admin"]);
    const body = schema.safeParse(await req.json());
    if (!body.success) throw new HttpError(400, "Invalid payout");
    const { merchantId, reference, note } = body.data;
    // A repeated id would be read twice in the transaction and paid twice.
    const merchantOrderIds = [...new Set(body.data.merchantOrderIds)];
    const db = adminDb();
    const settings = await getSettings();

    const payout = await db.runTransaction(async (tx) => {
      const merchantSnap = await tx.get(db.collection("merchants").doc(merchantId));
      if (!merchantSnap.exists) throw new HttpError(404, "Merchant not found");
      const rows = await Promise.all(
        merchantOrderIds.map((id) => tx.get(db.collection("merchantOrders").doc(id))),
      );
      const adjustments = await tx.get(
        db.collection("ledgerAdjustments").where("merchantId", "==", merchantId).where("status", "==", "open"),
      );

      let amount = 0;
      for (const snap of rows) {
        const row = snap.data() as MerchantOrder | undefined;
        if (!row || row.merchantId !== merchantId) throw new HttpError(400, "Order does not belong to merchant");
        const check = payoutEligibility(row, settings);
        if (!check.eligible) {
          throw new HttpError(check.reason === "settled" ? 409 : 400, `Order ${row.orderId} ${blockMessage[check.reason]}`);
        }
        amount += row.payoutAmount;
      }
      const adjustmentsTotal = round2(
        adjustments.docs.reduce((s, d) => s + (d.data() as LedgerAdjustment).amount, 0),
      );
      const total = round2(amount + adjustmentsTotal);
      if (total < 0) {
        throw new HttpError(400, "Refund deductions are larger than the selected orders — add more orders to this payout");
      }

      const ref = db.collection("payouts").doc();
      const record: Payout = {
        id: ref.id,
        merchantId,
        merchantName: (merchantSnap.data() as Merchant).storeName,
        amount: total,
        merchantOrderIds,
        ...(adjustments.size ? { adjustmentIds: adjustments.docs.map((d) => d.id), adjustmentsTotal } : {}),
        reference,
        note: note ?? "",
        createdBy: admin.uid,
        createdAt: Date.now(),
      };
      tx.set(ref, record);
      for (const snap of rows) tx.update(snap.ref, { payoutStatus: "paid", payoutId: ref.id });
      for (const d of adjustments.docs) tx.update(d.ref, { status: "applied", payoutId: ref.id });
      return record;
    });

    return Response.json(payout);
  } catch (err) {
    return errorResponse(err);
  }
}
