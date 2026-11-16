import { appUrl } from "@/lib/server/auth";
import { settleTamara } from "@/lib/server/orders";

/**
 * Tamara appends `orderId` (its own id) and `paymentStatus`. Public and unauthenticated, so the
 * query string is never trusted: settleTamara asks Tamara for the real status before recording
 * anything. The result page then reads the order's actual status from the server.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  const tamaraOrderId = url.searchParams.get("orderId");
  if (!ref) return Response.redirect(`${appUrl()}/`, 303);

  if (tamaraOrderId) {
    await settleTamara(ref, tamaraOrderId).catch((err) => console.error("tamara return", err));
  }
  return Response.redirect(`${appUrl()}/checkout/result?order=${encodeURIComponent(ref)}`, 303);
}
