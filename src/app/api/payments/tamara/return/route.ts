import { appUrl } from "@/lib/server/auth";
import { markOrderFailed, settleTamara } from "@/lib/server/orders";

/** Tamara appends `orderId` (its own id) and `paymentStatus`. settleTamara verifies with the API before recording. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  const tamaraOrderId = url.searchParams.get("orderId");
  const status = url.searchParams.get("paymentStatus");
  const go = (s: string) => Response.redirect(`${appUrl()}/checkout/result?order=${ref}&status=${s}`, 303);

  if (!ref) return Response.redirect(`${appUrl()}/`, 303);
  try {
    if (status === "approved" && tamaraOrderId) {
      return go(await settleTamara(ref, tamaraOrderId));
    }
    const cancelled = status === "canceled" || status === "cancelled";
    await markOrderFailed(ref, cancelled ? "cancelled" : "failed", `Tamara ${status}`);
    return go(cancelled ? "cancelled" : "failed");
  } catch (err) {
    console.error(err);
    return go("failed");
  }
}
