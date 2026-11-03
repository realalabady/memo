import { appUrl } from "@/lib/server/auth";
import { markOrderFailed, settleTabby } from "@/lib/server/orders";

/** Tabby redirects the shopper here with `payment_id` appended. We never trust the redirect alone — settleTabby re-checks with Tabby. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  const result = url.searchParams.get("result");
  const paymentId = url.searchParams.get("payment_id");
  const go = (status: string) =>
    Response.redirect(`${appUrl()}/checkout/result?order=${ref}&status=${status}`, 303);

  if (!ref) return Response.redirect(`${appUrl()}/`, 303);
  try {
    if (result === "success" && paymentId) {
      return go(await settleTabby(ref, paymentId));
    }
    await markOrderFailed(ref, result === "cancel" ? "cancelled" : "failed", `Tabby ${result}`);
    return go(result === "cancel" ? "cancelled" : "failed");
  } catch (err) {
    console.error(err);
    return go("failed");
  }
}
