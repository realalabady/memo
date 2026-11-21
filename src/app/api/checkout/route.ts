import { z } from "zod";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { demoProducts } from "@/lib/fixtures";
import { providerAvailable } from "@/lib/money";
import { providerConfigured, shouldSimulate } from "@/lib/payments";
import { getSettings } from "@/lib/server/orders";
import { createTabbySession } from "@/lib/payments/tabby";
import { createTamaraCheckout } from "@/lib/payments/tamara";
import { appUrl, errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { createPendingOrder, markOrderFailed, saveProviderRefs } from "@/lib/server/orders";
import { round2 } from "@/lib/utils";

const schema = z.object({
  provider: z.enum(["tabby", "tamara"]),
  /** Shopper's UI language — the provider's hosted page opens in the same language. */
  lang: z.enum(["ar", "en"]).default("ar"),
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
    nationalAddress: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || /^[A-Z]{4}\d{4}$/.test(v), "Invalid national address")
      .optional(),
  }),
});

export async function POST(req: Request) {
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success) throw new HttpError(400, "Please complete all checkout fields");
    const { provider, items, customer, lang } = body.data;

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
    await rateLimit("checkout", user.uid, 6);
    // Admin › Payments can switch a provider off; without keys it can only run in the development simulator.
    const settings = await getSettings();
    const label = provider === "tabby" ? "Tabby" : "Tamara";
    if ((provider === "tabby" ? settings.tabbyEnabled : settings.tamaraEnabled) === false) {
      throw new HttpError(400, `${label} is turned off. Choose the other option.`);
    }
    if (!(await shouldSimulate(provider)) && !(await providerConfigured(provider))) {
      throw new HttpError(503, `${label} isn't set up yet. Choose the other option.`);
    }
    // An unverified address could be someone else's: order emails and BNPL contact details must be real.
    if (!user.decoded.email_verified) throw new HttpError(403, "Verify your email address before checking out");
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

    if (await shouldSimulate(provider)) {
      return Response.json({
        url: `/checkout/demo?provider=${provider}&amount=${order.total}&order=${order.id}`,
      });
    }

    const profile = await adminDb().collection("users").doc(user.uid).get();
    const session =
      provider === "tabby"
        ? await createTabbySession(order, appUrl(), profile.data()?.createdAt as number | undefined, lang)
        : await createTamaraCheckout(order, appUrl(), lang);

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
