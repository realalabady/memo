import { randomBytes } from "node:crypto";
import { z } from "zod";
import { appUrl, errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/merchant";
import { getPaymentKeys, invalidatePaymentConfig, secretsRef } from "@/lib/server/payment-config";

const schema = z.object({ provider: z.enum(["tabby", "tamara"]), action: z.enum(["test", "register-webhook"]).default("test") });

type Result = { ok: boolean; message: string; webhookRegistered?: boolean };

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  return { status: res.status, body: (await res.json().catch(() => null)) as unknown };
}

async function testTabby(): Promise<Result> {
  const k = (await getPaymentKeys()).tabby;
  if (!k.secretKey || !k.merchantCode) return { ok: false, message: "Add the secret key and merchant code first." };
  // Listing webhooks needs both a valid key and a valid merchant code, and tells us if ours is registered.
  const { status, body } = await fetchJson(`${k.apiUrl}/api/v1/webhooks`, {
    headers: { Authorization: `Bearer ${k.secretKey}`, "X-Merchant-Code": k.merchantCode },
  });
  if (status === 401) return { ok: false, message: "Tabby rejected the secret key." };
  if (status === 403 || status === 404) return { ok: false, message: "Tabby accepted the key but not the merchant code." };
  if (status !== 200) return { ok: false, message: `Tabby answered ${status}.` };
  const target = `${appUrl()}/api/webhooks/tabby`;
  const list = Array.isArray(body) ? body : [];
  const webhookRegistered = list.some((w) => (w as { url?: string }).url === target);
  return { ok: true, message: `Connected to Tabby (${k.secretKey.startsWith("sk_test") ? "test" : "live"} keys).`, webhookRegistered };
}

async function testTamara(): Promise<Result> {
  const k = (await getPaymentKeys()).tamara;
  if (!k.apiToken) return { ok: false, message: "Add the API token first." };
  const { status } = await fetchJson(`${k.apiUrl}/checkout/payment-types?country=SA&currency=SAR&order_value=500`, {
    headers: { Authorization: `Bearer ${k.apiToken}` },
  });
  if (status === 401 || status === 403) return { ok: false, message: "Tamara rejected the API token (check sandbox vs production)." };
  if (status !== 200) return { ok: false, message: `Tamara answered ${status}.` };
  return {
    ok: true,
    message: `Connected to Tamara (${k.apiUrl.includes("sandbox") ? "sandbox" : "production"}).${k.notificationToken ? "" : " Add the notification token so webhooks are accepted."}`,
  };
}

/** Tabby webhooks must be registered through its API (Tamara gets the URL with every checkout). */
async function registerTabbyWebhook(adminUid: string): Promise<Result> {
  const base = appUrl();
  if (!base.startsWith("https://")) return { ok: false, message: "Webhooks need the site's public https address (NEXT_PUBLIC_APP_URL)." };
  let k = (await getPaymentKeys()).tabby;
  if (!k.secretKey || !k.merchantCode) return { ok: false, message: "Add the secret key and merchant code first." };
  if (!k.webhookSecret) {
    // Generate the shared header secret and keep it server-side.
    await secretsRef().set({ tabby: { webhookSecret: randomBytes(24).toString("base64url") }, updatedAt: Date.now() }, { merge: true });
    invalidatePaymentConfig();
    k = (await getPaymentKeys()).tabby;
  }
  const { status, body } = await fetchJson(`${k.apiUrl}/api/v1/webhooks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${k.secretKey}`, "X-Merchant-Code": k.merchantCode, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${base}/api/webhooks/tabby`,
      is_test: k.secretKey.startsWith("sk_test"),
      header: { title: "X-Webhook-Secret", value: k.webhookSecret },
    }),
  });
  if (status >= 300) return { ok: false, message: `Tabby refused the webhook (${status}): ${JSON.stringify(body).slice(0, 200)}` };
  await audit(adminUid, "admin.payments.tabby-webhook", "secrets/payments", { url: `${base}/api/webhooks/tabby` });
  return { ok: true, message: "Tabby webhook registered.", webhookRegistered: true };
}

/** Admin: check the saved keys against the provider, or register the Tabby webhook. */
export async function POST(req: Request) {
  try {
    const admin = await requireUser(req, ["admin"]);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Invalid request");
    const { provider, action } = parsed.data;
    const result =
      action === "register-webhook"
        ? provider === "tabby"
          ? await registerTabbyWebhook(admin.uid)
          : { ok: false, message: "Tamara receives the webhook address with every checkout." }
        : provider === "tabby"
          ? await testTabby()
          : await testTamara();
    return Response.json(result);
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") return Response.json({ ok: false, message: "The provider didn't answer in time." });
    return errorResponse(err);
  }
}
