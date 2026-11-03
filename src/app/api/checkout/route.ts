import { z } from "zod";
import { isAdminConfigured } from "@/lib/firebase/admin";
import { demoProducts } from "@/lib/fixtures";
import { providerAvailable } from "@/lib/money";
import { shouldSimulate } from "@/lib/payments";
import { createTabbySession } from "@/lib/payments/tabby";
import { createTamaraCheckout } from "@/lib/payments/tamara";
import { appUrl, errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { createPendingOrder, markOrderFailed, saveProviderRefs } from "@/lib/server/orders";
import { round2 } from "@/lib/utils";

const schema = z.object({
  provider: z.enum(["tabby", "tamara"]),
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(20) }))
    .min(1)
    .max(50),
  customer: z.object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    email: z.email(),
    phone: z.string().trim().min(8).max(20),
    city: z.string().trim().min(2).max(60),
    line1: z.string().trim().min(3).max(200),
    zip: z.string().trim().max(10).optional(),
  }),
});

export async function POST(req: Request) {
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success) throw new HttpError(400, "Please complete all checkout fields");
    const { provider, items, customer } = body.data;

    // Demo mode (no Firebase): price from sample data and go straight to the simulator.
    if (!isAdminConfigured) {
      const total = round2(
        items.reduce((s, i) => s + (demoProducts.find((p) => p.id === i.productId)?.price ?? 0) * i.quantity, 0),
      );
      return Response.json({
        url: `/checkout/demo?provider=${provider}&amount=${total}&order=demo`,
      });
    }

    const user = await requireUser(req);
    const order = await createPendingOrder({
      customerId: user.uid,
      customer,
      items,
      provider,
      splitAs: provider,
    });

    if (!providerAvailable(provider, order.total)) {
      await markOrderFailed(order.id, "failed", "Amount outside provider limits");
      throw new HttpError(400, `${provider === "tabby" ? "Tabby" : "Tamara"} isn't available for this amount`);
    }

    if (shouldSimulate(provider)) {
      return Response.json({
        url: `/checkout/demo?provider=${provider}&amount=${order.total}&order=${order.id}`,
      });
    }

    const session =
      provider === "tabby"
        ? await createTabbySession(order, appUrl())
        : await createTamaraCheckout(order, appUrl());

    if (!session.ok) {
      await markOrderFailed(order.id, "failed", session.reason);
      throw new HttpError(
        402,
        `${provider === "tabby" ? "Tabby" : "Tamara"} couldn't approve this purchase. Try the other option.`,
      );
    }
    await saveProviderRefs(order.id, { checkoutId: session.checkoutId, paymentId: session.paymentId });
    return Response.json({ url: session.url, orderId: order.id });
  } catch (err) {
    return errorResponse(err);
  }
}
