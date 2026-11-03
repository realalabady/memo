import { verifyTamaraWebhook } from "@/lib/payments/tamara";
import { markOrderFailed, settleTamara } from "@/lib/server/orders";

/** Notification URL is sent with every checkout (merchant_url.notification). */
export async function POST(req: Request) {
  if (!(await verifyTamaraWebhook(req))) return new Response("unauthorized", { status: 401 });
  const event = (await req.json()) as {
    order_id: string;
    order_reference_id: string;
    event_type?: string;
    order_status?: string;
  };
  try {
    const type = (event.event_type ?? event.order_status ?? "").toLowerCase();
    if (type.includes("approved") || type.includes("authorised")) {
      await settleTamara(event.order_reference_id, event.order_id);
    } else if (type.includes("declined") || type.includes("expired") || type.includes("canceled")) {
      await markOrderFailed(event.order_reference_id, "failed", `Tamara ${type}`);
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
}
