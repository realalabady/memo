import { timingSafeEqual } from "node:crypto";
import { markOrderFailed, settleTabby } from "@/lib/server/orders";

/**
 * Register in Tabby with: url = {APP_URL}/api/webhooks/tabby,
 * header { title: "X-Webhook-Secret", value: TABBY_WEBHOOK_SECRET }.
 */
function authorized(req: Request) {
  const expected = process.env.TABBY_WEBHOOK_SECRET;
  const got = req.headers.get("x-webhook-secret");
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const event = (await req.json()) as {
    id: string;
    status: string;
    order?: { reference_id?: string };
  };
  const orderId = event.order?.reference_id;
  if (!orderId) return Response.json({ ok: true });

  try {
    const status = event.status.toLowerCase();
    if (status === "authorized" || status === "closed") {
      await settleTabby(orderId, event.id);
    } else if (status === "rejected" || status === "expired") {
      await markOrderFailed(orderId, "failed", `Tabby ${status}`);
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
}
