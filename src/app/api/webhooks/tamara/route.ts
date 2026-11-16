import { getTamaraOrder, verifyTamaraWebhook } from "@/lib/payments/tamara";
import { getOrder, markOrderFailed, settleTamara } from "@/lib/server/orders";
import { handleOnce } from "@/lib/server/payment-events";
import { applyRefund, flagForReview, refundInProgress } from "@/lib/server/refunds";

/**
 * Notification URL is sent with every checkout (merchant_url.notification).
 * The body is only a hint: every decision re-reads the order from Tamara's API.
 */
async function syncRefunds(orderId: string, tamaraOrderId: string) {
  const order = await getOrder(orderId);
  if (!order || order.paymentStatus !== "captured") return;
  if (await refundInProgress(order)) throw new Error("Refund still being recorded — retry later");
  const remote = await getTamaraOrder(tamaraOrderId);
  if (remote.order_reference_id !== orderId) return;
  const refunded = remote.refunded_amount?.amount ?? (remote.status.toLowerCase() === "fully_refunded" ? order.total : 0);
  if (refunded <= (order.refundedAmount ?? 0) + 0.01) return; // nothing new (our own refunds are already recorded)
  if (refunded >= order.total - 0.01) {
    await applyRefund({ orderId, reason: "Refunded in Tamara" });
  } else {
    await flagForReview(orderId, `Tamara shows SAR ${refunded.toFixed(2)} refunded — record which store's items were refunded.`);
  }
}

export async function POST(req: Request) {
  if (!(await verifyTamaraWebhook(req))) return new Response("unauthorized", { status: 401 });
  const event = (await req.json().catch(() => null)) as {
    order_id?: string;
    order_reference_id?: string;
    event_type?: string;
    order_status?: string;
    data?: { refund_id?: string; capture_id?: string };
  } | null;
  const orderId = event?.order_reference_id;
  const tamaraOrderId = event?.order_id;
  const type = (event?.event_type ?? event?.order_status ?? "").toLowerCase();
  if (!event || !orderId || !tamaraOrderId || !type) return Response.json({ ok: true });

  const key = `${tamaraOrderId}:${type}:${event.data?.refund_id ?? event.data?.capture_id ?? ""}`;
  try {
    const result = await handleOnce("tamara", key, event, async () => {
      if (type.includes("refund")) {
        await syncRefunds(orderId, tamaraOrderId);
      } else if (type.includes("approved") || type.includes("authorised") || type.includes("captured")) {
        await settleTamara(orderId, tamaraOrderId);
      } else if (type.includes("declined") || type.includes("expired") || type.includes("canceled")) {
        // No-op for paid/refunded orders; releases stock for unpaid ones.
        await markOrderFailed(orderId, "failed", `Tamara ${type}`);
      }
    });
    return Response.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 }); // Tamara retries
  }
}
