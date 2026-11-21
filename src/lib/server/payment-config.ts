import "server-only";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";

/**
 * Tabby / Tamara credentials. Set by admins at /admin/payments (stored in secrets/payments, which
 * Firestore rules close to every client) with the server environment variables as fallback.
 * Secret values never leave the server: the admin API only returns masked versions.
 */
export interface PaymentKeys {
  tabby: { secretKey: string; merchantCode: string; apiUrl: string; webhookSecret: string };
  tamara: { apiToken: string; apiUrl: string; notificationToken: string };
}
export type KeySource = "dashboard" | "env" | "none";

export const TABBY_API_DEFAULT = "https://api.tabby.ai";
export const TAMARA_SANDBOX = "https://api-sandbox.tamara.co";
export const TAMARA_PRODUCTION = "https://api.tamara.co";

/** Which fields are secret (masked in the dashboard, never returned in full). */
export const SECRET_FIELDS = {
  tabby: ["secretKey", "webhookSecret"],
  tamara: ["apiToken", "notificationToken"],
} as const;

type Stored = { tabby?: Partial<PaymentKeys["tabby"]>; tamara?: Partial<PaymentKeys["tamara"]>; updatedAt?: number };

const TTL_MS = 30_000;
let cache: { at: number; stored: Stored } | null = null;

export const secretsRef = () => adminDb().collection("secrets").doc("payments");

async function readStored(): Promise<Stored> {
  if (!isAdminConfigured) return {};
  if (cache && Date.now() - cache.at < TTL_MS) return cache.stored;
  const stored = ((await secretsRef().get()).data() ?? {}) as Stored;
  cache = { at: Date.now(), stored };
  return stored;
}

/** Call after saving so this server instance uses the new keys immediately (others pick them up within 30 s). */
export function invalidatePaymentConfig() {
  cache = null;
}

const pick = (stored: string | undefined, env: string | undefined, fallback = "") => (stored?.trim() || env?.trim() || fallback);

export async function getPaymentKeys(): Promise<PaymentKeys> {
  const s = await readStored();
  const e = process.env;
  return {
    tabby: {
      secretKey: pick(s.tabby?.secretKey, e.TABBY_SECRET_KEY),
      merchantCode: pick(s.tabby?.merchantCode, e.TABBY_MERCHANT_CODE),
      apiUrl: pick(s.tabby?.apiUrl, e.TABBY_API_URL, TABBY_API_DEFAULT).replace(/\/$/, ""),
      webhookSecret: pick(s.tabby?.webhookSecret, e.TABBY_WEBHOOK_SECRET),
    },
    tamara: {
      apiToken: pick(s.tamara?.apiToken, e.TAMARA_API_TOKEN),
      apiUrl: pick(s.tamara?.apiUrl, e.TAMARA_API_URL, TAMARA_SANDBOX).replace(/\/$/, ""),
      notificationToken: pick(s.tamara?.notificationToken, e.TAMARA_NOTIFICATION_TOKEN),
    },
  };
}

export async function tabbyConfigured() {
  const k = (await getPaymentKeys()).tabby;
  return Boolean(k.secretKey && k.merchantCode);
}

export async function tamaraConfigured() {
  return Boolean((await getPaymentKeys()).tamara.apiToken);
}

/** "sk_test_…a1b2" style preview: enough to recognise a key, useless to anyone who sees it. */
export function mask(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, Math.min(8, Math.floor(value.length / 4)))}…${value.slice(-4)}`;
}

/** Where each field currently comes from, for the dashboard. */
export async function keySources() {
  const s = await readStored();
  const e = process.env;
  const src = (stored: string | undefined, env: string | undefined): KeySource => (stored?.trim() ? "dashboard" : env?.trim() ? "env" : "none");
  return {
    tabby: {
      secretKey: src(s.tabby?.secretKey, e.TABBY_SECRET_KEY),
      merchantCode: src(s.tabby?.merchantCode, e.TABBY_MERCHANT_CODE),
      apiUrl: src(s.tabby?.apiUrl, e.TABBY_API_URL),
      webhookSecret: src(s.tabby?.webhookSecret, e.TABBY_WEBHOOK_SECRET),
    },
    tamara: {
      apiToken: src(s.tamara?.apiToken, e.TAMARA_API_TOKEN),
      apiUrl: src(s.tamara?.apiUrl, e.TAMARA_API_URL),
      notificationToken: src(s.tamara?.notificationToken, e.TAMARA_NOTIFICATION_TOKEN),
    },
    updatedAt: s.updatedAt ?? 0,
  };
}
