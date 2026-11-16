import { timingSafeEqual } from "node:crypto";
import { getTabbyPayment, tabbyRefundedTotal } from "@/lib/payments/tabby";
import { getOrder, markOrderFailed, settleTabby } from "@/lib/server/orders";
import { handleOnce } from "@/lib/server/payment-events";
import { applyRefund, flagForReview, refundInProgress } from "@/lib/server/refunds";

/**
 * Register in Tabby with: url = {APP_URL}/api/webhooks/tabby,
 * header { title: "X-Webhook-Secret", value: TABBY_WEBHOOK_SECRET } — see scripts/register-tabby-webhook.ts.
 * The body is only a hint: every decision re-reads the payment from Tabby's API.
 */
function authorized(req: Request) {
  const expected = process.env.TABBY_WEBHOOK_SECRET;
  const got = req.headers.get("x-webhook-secret");
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A refund made in Tabby's dashboard: record a full refund, flag a partial one for the admin. */
async function syncRefunds(orderId: string, paymentId: string) {
  const order = await getOrder(orderId);
  if (!order || order.paymentStatus !== "captured") return;
  if (await refundInProgress(order)) throw new Error("Refund still being recorded — retry later");
  const payment = await getTabbyPayment(paymentId);
  if (payment.order?.reference_id !== orderId) return;
  const refunded = tabbyRefundedTotal(payment);
  if (refunded <= (order.refundedAmount ?? 0) + 0.01) return; // nothing new (our own refunds are already recorded)
  if (refunded >= order.total - 0.01) {
    await applyRefund({ orderId, reason: "Refunded in Tabby" });
  } else {
    await flagForReview(orderId, `Tabby shows SAR ${refunded.toFixed(2)} refunded — record which store's items were refunded.`);
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const event = (await req.json().catch(() => null)) as {
    id?: string;
    status?: string;
    order?: { reference_id?: string };
    refunds?: unknown[];
    captures?: unknown[];
  } | null;
  const orderId = event?.order?.reference_id;
  const paymentId = event?.id;
  if (!event || !orderId || !paymentId || !event.status) return Response.json({ ok: true });

  const status = event.status.toLowerCase();
  // The same payment sends several events as it moves on; refunds/captures counts tell them apart.
  const key = `${paymentId}:${status}:${event.captures?.length ?? 0}:${event.refunds?.length ?? 0}`;
  try {
    const result = await handleOnce("tabby", key, event, async () => {
      if (status === "authorized") {
        await settleTabby(orderId, paymentId);
      } else if (status === "closed") {
        await settleTabby(orderId, paymentId);
        await syncRefunds(orderId, paymentId);
      } else if (status === "rejected" || status === "expired") {
        await markOrderFailed(orderId, "failed", `Tabby ${status}`);
      }
    });
    return Response.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 }); // Tabby retries
  }
}
