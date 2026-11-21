import "server-only";
import { getPaymentKeys } from "@/lib/server/payment-config";
import type { Order } from "@/lib/types";

/**
 * Tabby — Pay in 4. All sessions are created with the PLATFORM's secret key,
 * so every payment settles into the marketplace owner's Tabby account.
 * Docs: https://docs.tabby.ai
 */

export { tabbyConfigured } from "@/lib/server/payment-config";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiUrl, secretKey } = (await getPaymentKeys()).tabby;
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Tabby ${res.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

interface TabbySession {
  id: string;
  status: "created" | "rejected" | "expired" | "approved";
  payment: { id: string };
  configuration?: {
    available_products?: { installments?: { web_url: string }[] };
    products?: { installments?: { rejection_reason?: string | null } };
  };
}

/** `buyerSince` = the customer's account creation time (Tabby uses it for risk scoring). */
export async function createTabbySession(order: Order, base: string, buyerSince?: number, lang: "ar" | "en" = "ar") {
  const ret = (result: string) =>
    `${base}/api/payments/tabby/return?ref=${order.id}&result=${result}`;
  const session = await call<TabbySession>("/api/v2/checkout", {
    method: "POST",
    body: JSON.stringify({
      payment: {
        amount: order.total.toFixed(2),
        currency: order.currency,
        description: `Memo order ${order.id}`,
        buyer: {
          name: `${order.customer.firstName} ${order.customer.lastName}`,
          email: order.customer.email,
          phone: normalizeSaPhone(order.customer.phone),
        },
        shipping_address: {
          city: order.customer.city,
          address: order.customer.line1,
          zip: order.customer.zip ?? "00000",
        },
        order: {
          reference_id: order.id,
          // Prices are VAT-inclusive: this reports the VAT contained in the amount, it is not added on top.
          tax_amount: (order.vatAmount ?? 0).toFixed(2),
          shipping_amount: "0.00",
          discount_amount: "0.00",
          items: order.items.map((i) => ({
            reference_id: i.productId,
            title: i.title,
            quantity: i.quantity,
            unit_price: i.unitPrice.toFixed(2),
            category: "General",
            image_url: i.image,
          })),
        },
        buyer_history: { registered_since: new Date(buyerSince ?? order.createdAt).toISOString(), loyalty_level: 0 },
        order_history: [],
      },
      lang,
      merchant_code: (await getPaymentKeys()).tabby.merchantCode,
      merchant_urls: {
        success: ret("success"),
        cancel: ret("cancel"),
        failure: ret("failure"),
      },
    }),
  });

  const url = session.configuration?.available_products?.installments?.[0]?.web_url;
  if (session.status !== "created" || !url) {
    const reason =
      session.configuration?.products?.installments?.rejection_reason ?? "not_available";
    return { ok: false as const, reason };
  }
  return { ok: true as const, url, checkoutId: session.id, paymentId: session.payment.id };
}

export interface TabbyPayment {
  id: string;
  status: "CREATED" | "AUTHORIZED" | "CLOSED" | "REJECTED" | "EXPIRED";
  amount: string;
  currency: string;
  order: { reference_id: string };
  captures?: { amount: string }[];
  refunds?: { amount: string }[];
}

/** Total refunded on a Tabby payment so far. */
export const tabbyRefundedTotal = (p: TabbyPayment) => sum(p.refunds);

const sum = (rows?: { amount: string }[]) => (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);

/** CLOSED also covers refunded/voided payments — only count it as paid when fully captured and not refunded. */
export function tabbyPaymentIsPaid(p: TabbyPayment, total: number) {
  return p.status === "CLOSED" && sum(p.captures) >= total - 0.01 && sum(p.refunds) === 0;
}

/** Normalises Saudi mobiles to +9665XXXXXXXX (Tabby/Tamara pre-scoring is phone-based). */
export function normalizeSaPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  if (digits.startsWith("9665") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("05") && digits.length === 10) return `+966${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `+966${digits}`;
  return raw.trim().startsWith("+") ? raw.trim() : `+${digits}`;
}

export const getTabbyPayment = (id: string) => call<TabbyPayment>(`/api/v2/payments/${id}`);

export const captureTabbyPayment = (id: string, amount: number, reference: string) =>
  call<TabbyPayment>(`/api/v2/payments/${id}/captures`, {
    method: "POST",
    body: JSON.stringify({ amount: amount.toFixed(2), reference_id: reference }),
  });

/** Refund part or all of a captured payment. `reference` makes retries safe on Tabby's side. */
export const refundTabbyPayment = (id: string, amount: number, reference: string, reason: string) =>
  call<TabbyPayment>(`/api/v2/payments/${id}/refunds`, {
    method: "POST",
    body: JSON.stringify({ amount: amount.toFixed(2), reference_id: reference, reason: reason.slice(0, 200) }),
  });

/** Close an authorised payment without capturing the rest (voids the uncaptured amount). */
export const closeTabbyPayment = (id: string) => call<TabbyPayment>(`/api/v2/payments/${id}/close`, { method: "POST" });
