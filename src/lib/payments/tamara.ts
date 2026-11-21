import "server-only";
import { getPaymentKeys } from "@/lib/server/payment-config";
import { jwtVerify } from "jose";
import type { Order } from "@/lib/types";
import { normalizeSaPhone } from "./tabby";

/**
 * Tamara — split in 3/4. Checkouts are created with the PLATFORM's API token,
 * so funds settle into the marketplace owner's Tamara account.
 * Docs: https://docs.tamara.co
 */

export { tamaraConfigured } from "@/lib/server/payment-config";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiUrl, apiToken } = (await getPaymentKeys()).tamara;
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Tamara ${res.status}: ${JSON.stringify(body)}`);
  return body as T;
}

const money = (amount: number) => ({ amount: Number(amount.toFixed(2)), currency: "SAR" });

export async function createTamaraCheckout(order: Order, base: string, lang: "ar" | "en" = "ar") {
  const ret = `${base}/api/payments/tamara/return?ref=${order.id}`;
  const c = order.customer;
  try {
    const res = await call<{ order_id: string; checkout_id: string; checkout_url: string }>(
      "/checkout",
      {
        method: "POST",
        body: JSON.stringify({
          order_reference_id: order.id,
          order_number: order.id,
          total_amount: money(order.total),
          description: `Memo order ${order.id}`,
          country_code: "SA",
          payment_type: "PAY_BY_INSTALMENTS",
          instalments: 4,
          locale: lang === "ar" ? "ar_SA" : "en_US",
          items: order.items.map((i) => ({
            reference_id: i.productId,
            type: "Physical",
            name: i.title,
            sku: i.productId,
            quantity: i.quantity,
            unit_price: money(i.unitPrice),
            total_amount: money(i.total),
            image_url: i.image,
          })),
          consumer: { first_name: c.firstName, last_name: c.lastName, phone_number: normalizeSaPhone(c.phone), email: c.email },
          shipping_address: {
            first_name: c.firstName,
            last_name: c.lastName,
            line1: c.line1,
            city: c.city,
            country_code: "SA",
            phone_number: normalizeSaPhone(c.phone),
          },
          // Prices are VAT-inclusive: this reports the VAT contained in total_amount, it is not added on top.
          tax_amount: money(order.vatAmount ?? 0),
          shipping_amount: money(0),
          merchant_url: {
            success: ret,
            failure: ret,
            cancel: ret,
            notification: `${base}/api/webhooks/tamara`,
          },
        }),
      },
    );
    return { ok: true as const, url: res.checkout_url, checkoutId: res.checkout_id, paymentId: res.order_id };
  } catch (e) {
    console.error(e);
    return { ok: false as const, reason: "not_available" };
  }
}

export interface TamaraOrder {
  order_id: string;
  order_reference_id: string;
  status: string; // new | approved | authorised | fully_captured | declined | expired | canceled ...
  total_amount: { amount: number; currency: string };
  captured_amount?: { amount: number; currency: string };
  refunded_amount?: { amount: number; currency: string };
}

export const getTamaraOrder = (id: string) => call<TamaraOrder>(`/orders/${id}`);

export const authoriseTamaraOrder = (id: string) =>
  call<{ order_id: string; status: string }>(`/orders/${id}/authorise`, { method: "POST" });

export const captureTamaraOrder = (id: string, amount: number) =>
  call(`/payments/capture`, {
    method: "POST",
    body: JSON.stringify({
      order_id: id,
      total_amount: money(amount),
      shipping_info: { shipped_at: new Date().toISOString(), shipping_company: "Memo Marketplace" },
    }),
  });

/** Refund part or all of a captured order (Tamara "simplified refund"). */
export const refundTamaraOrder = (id: string, amount: number, comment: string) =>
  call<{ refund_id?: string; order_id: string }>(`/payments/simplified-refund/${id}`, {
    method: "POST",
    body: JSON.stringify({ total_amount: money(amount), comment: comment.slice(0, 200) }),
  });

/** Cancel an authorised order that was never captured. */
export const cancelTamaraOrder = (id: string, amount: number) =>
  call<{ order_id: string; status: string }>(`/orders/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ total_amount: money(amount) }),
  });

/** Tamara signs webhooks with a HS256 JWT (`tamaraToken` query or Bearer header). */
export async function verifyTamaraWebhook(req: Request) {
  const secret = (await getPaymentKeys()).tamara.notificationToken;
  if (!secret) return false;
  const url = new URL(req.url);
  const header = req.headers.get("authorization") ?? "";
  const token = url.searchParams.get("tamaraToken") ?? (header.startsWith("Bearer ") ? header.slice(7) : "");
  if (!token) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
