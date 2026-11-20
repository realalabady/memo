import { connection } from "next/server";
import { AggregateField } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, requireUser } from "@/lib/server/auth";
import type { AdminStats } from "@/lib/types";

/**
 * Admin: marketplace totals computed by Firestore aggregation over every ledger row
 * (the dashboard's live list only holds the newest 1,000).
 */
export async function GET(req: Request) {
  await connection(); // per-request data, never prerendered (outside try: Next uses its rejection)
  try {
    await requireUser(req, ["admin"]);
    const db = adminDb();
    const captured = db.collection("merchantOrders").where("paymentStatus", "==", "captured");
    const num = (v: unknown) => (typeof v === "number" ? v : 0);

    const [all, tabby, tamara, owedSnap, payouts] = await Promise.all([
      captured
        .aggregate({
          count: AggregateField.count(),
          subtotal: AggregateField.sum("subtotal"),
          commission: AggregateField.sum("commission"),
          providerFee: AggregateField.sum("providerFee"),
        })
        .get(),
      captured.where("provider", "==", "tabby").aggregate({ subtotal: AggregateField.sum("subtotal") }).get(),
      captured.where("provider", "==", "tamara").aggregate({ subtotal: AggregateField.sum("subtotal") }).get(),
      // Unpaid rows are a bounded working set; read just the fields needed to group them per store.
      captured.where("payoutStatus", "in", ["unpaid", "on_hold"]).select("merchantId", "merchantName", "payoutAmount").get(),
      db.collection("payouts").aggregate({ count: AggregateField.count(), amount: AggregateField.sum("amount") }).get(),
    ]);

    const balances = new Map<string, AdminStats["balances"][number]>();
    for (const d of owedSnap.docs) {
      const { merchantId, merchantName, payoutAmount } = d.data();
      const b = balances.get(merchantId) ?? { id: merchantId, name: merchantName, amount: 0, count: 0 };
      b.amount += num(payoutAmount);
      b.count += 1;
      balances.set(merchantId, b);
    }
    const a = all.data();
    const stats: AdminStats = {
      paidCount: a.count,
      collected: num(a.subtotal),
      commission: num(a.commission),
      providerFees: num(a.providerFee),
      tabby: num(tabby.data().subtotal),
      tamara: num(tamara.data().subtotal),
      owed: [...balances.values()].reduce((s, b) => s + b.amount, 0),
      balances: [...balances.values()].sort((x, y) => y.amount - x.amount),
      transferred: num(payouts.data().amount),
      payoutCount: payouts.data().count,
    };
    return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
