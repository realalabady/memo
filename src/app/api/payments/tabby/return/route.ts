import { appUrl } from "@/lib/server/auth";
import { settleTabby } from "@/lib/server/orders";

/**
 * Tabby redirects the shopper here with `payment_id`. This URL is public and unauthenticated,
 * so it never changes an order on its own say-so: it only asks Tabby for the payment's real
 * state (settleTabby). Unfinished checkouts are released later by the expiry cron.
 * The result page then reads the order's actual status from the server.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  const paymentId = url.searchParams.get("payment_id");
  if (!ref) return Response.redirect(`${appUrl()}/`, 303);

  if (paymentId) {
    await settleTabby(ref, paymentId).catch((err) => console.error("tabby return", err));
  }
  return Response.redirect(`${appUrl()}/checkout/result?order=${encodeURIComponent(ref)}`, 303);
}
