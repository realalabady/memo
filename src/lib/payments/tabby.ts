import "server-only";
import type { Order } from "@/lib/types";

/**
 * Tabby — Pay in 4. All sessions are created with the PLATFORM's secret key,
 * so every payment settles into the marketplace owner's Tabby account.
 * Docs: https://docs.tabby.ai
 */
const API = () => (process.env.TABBY_API_URL ?? "https://api.tabby.ai").replace(/\/$/, "");
const key = () => process.env.TABBY_SECRET_KEY ?? "";

export const tabbyConfigured = () => Boolean(process.env.TABBY_SECRET_KEY && process.env.TABBY_MERCHANT_CODE);

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key()}`,
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

export async function createTabbySession(order: Order, base: string) {
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
          phone: order.customer.phone,
        },
        shipping_address: {
          city: order.customer.city,
          address: order.customer.line1,
          zip: order.customer.zip ?? "00000",
        },
        order: {
          reference_id: order.id,
          tax_amount: "0.00",
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
        buyer_history: { registered_since: new Date(order.createdAt).toISOString(), loyalty_level: 0 },
        order_history: [],
      },
      lang: "en",
      merchant_code: process.env.TABBY_MERCHANT_CODE,
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
}

export const getTabbyPayment = (id: string) => call<TabbyPayment>(`/api/v2/payments/${id}`);

export const captureTabbyPayment = (id: string, amount: number, reference: string) =>
  call<TabbyPayment>(`/api/v2/payments/${id}/captures`, {
    method: "POST",
    body: JSON.stringify({ amount: amount.toFixed(2), reference_id: reference }),
  });
