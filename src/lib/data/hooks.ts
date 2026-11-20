"use client";

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { LEGAL_SLUGS, withLegalDefaults, type LegalPage } from "@/lib/legal";
import { demoCategories, demoLedger, demoMerchants, demoProducts } from "@/lib/fixtures";
import {
  DEFAULT_SETTINGS,
  type Category,
  type LedgerAdjustment,
  type Merchant,
  type MerchantBank,
  type MerchantContact,
  type MerchantOrder,
  type Order,
  type Payout,
  type PlatformSettings,
  type Product,
  type SavedAddress,
  type AuditLog,
  type StorefrontSettings,
  type UserProfile,
  DEFAULT_STOREFRONT,
  withStorefrontDefaults,
} from "@/lib/types";

interface Live<T> {
  data: T;
  loading: boolean;
  error?: string;
}

/** Subscribes to a Firestore query, or returns sample data in demo mode. */
function useLive<T extends { createdAt?: number }>(
  build: (() => Query) | null,
  demo: () => T[],
  deps: unknown[],
): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: true });
  useEffect(() => {
    if (!isFirebaseConfigured) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- demo data is resolved client-side
      setState({ data: demo(), loading: false });
      return;
    }
    if (!build) return;
    return onSnapshot(
      build(),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T);
        rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        setState({ data: rows, loading: false });
      },
      (err) => setState({ data: [], loading: false, error: err.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function useMerchantOrders(merchantId?: string | null) {
  return useLive<MerchantOrder>(
    merchantId === null
      ? null
      : () =>
          merchantId
            ? query(collection(db(), "merchantOrders"), where("merchantId", "==", merchantId))
            : query(collection(db(), "merchantOrders"), orderBy("createdAt", "desc"), limit(1000)),
    () => demoLedger().orders.filter((o) => !merchantId || o.merchantId === merchantId),
    [merchantId],
  );
}

export function usePayouts(merchantId?: string | null) {
  return useLive<Payout>(
    merchantId === null
      ? null
      : () =>
          merchantId
            ? query(collection(db(), "payouts"), where("merchantId", "==", merchantId))
            : query(collection(db(), "payouts"), orderBy("createdAt", "desc"), limit(500)),
    () => demoLedger().payouts.filter((p) => !merchantId || p.merchantId === merchantId),
    [merchantId],
  );
}

/** Open refund clawbacks for a merchant (deducted from their next payout). */
export function useOpenAdjustments(merchantId: string | null) {
  return useLive<LedgerAdjustment>(
    merchantId
      ? () => query(collection(db(), "ledgerAdjustments"), where("merchantId", "==", merchantId), where("status", "==", "open"))
      : null,
    () => [],
    [merchantId],
  );
}

/** The signed-in shopper's saved delivery addresses. */
export function useAddresses(uid: string | null) {
  return useLive<SavedAddress>(
    uid ? () => query(collection(db(), "users", uid, "addresses")) : null,
    () => [],
    [uid],
  );
}

export function useCustomerOrders(customerId: string | null) {
  return useLive<Order>(
    customerId ? () => query(collection(db(), "orders"), where("customerId", "==", customerId)) : null,
    () => {
      const rows = demoLedger().orders.filter((o) => o.customerId === "c0");
      return rows.map((r) => ({
        id: r.orderId,
        customerId: r.customerId,
        customer: r.customer,
        items: r.items,
        merchantIds: [r.merchantId],
        subtotal: r.subtotal,
        total: r.subtotal,
        currency: "SAR" as const,
        provider: r.provider,
        paymentStatus: r.paymentStatus,
        createdAt: r.createdAt,
      }));
    },
    [customerId],
  );
}

export function useMerchantProducts(merchantId: string | null) {
  const live = useLive<Product>(
    merchantId ? () => query(collection(db(), "products"), where("merchantId", "==", merchantId)) : null,
    () => demoProducts.filter((p) => p.merchantId === merchantId),
    [merchantId],
  );
  return { ...live, data: live.data.filter((p) => p.status !== "archived") };
}

export function useMerchants() {
  return useLive<Merchant>(
    () => query(collection(db(), "merchants")),
    () => [
      ...demoMerchants,
      { id: "m_pending", storeName: "Qahwa Lab", slug: "qahwa-lab", status: "pending", city: "Madinah", email: "hello@qahwalab.sa", createdAt: Date.now() - 86_400_000 } as Merchant,
    ],
    [],
  );
}

export function useCategories() {
  const live = useLive<Category & { createdAt?: number }>(
    () => query(collection(db(), "categories")),
    () => demoCategories,
    [],
  );
  return { ...live, data: [...live.data].sort((a, b) => a.order - b.order) };
}

/** Single-document subscription helper */
function useDoc<T>(path: string[] | null, demo: T): Live<T> {
  const [state, setState] = useState<Live<T>>({ data: demo, loading: true });
  const key = path?.join("/");
  useEffect(() => {
    if (!isFirebaseConfigured) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- demo data is resolved client-side
      setState({ data: demo, loading: false });
      return;
    }
    if (!path) return;
    const [first, ...rest] = path;
    return onSnapshot(
      doc(db(), first, ...rest),
      (snap) => setState({ data: (snap.exists() ? { ...demo, ...snap.data() } : demo) as T, loading: false }),
      (err) => setState({ data: demo, loading: false, error: err.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useSettings() {
  return useDoc<PlatformSettings>(["settings", "platform"], DEFAULT_SETTINGS);
}

const emptyBank: MerchantBank = { accountHolder: "", bankName: "", iban: "", updatedAt: 0 };
const demoBank: MerchantBank = { accountHolder: "Atelier Najd Trading Est.", bankName: "Al Rajhi Bank", iban: "SA03 8000 0000 6080 1016 7519", updatedAt: 0 };

export function useMerchantBank(merchantId: string | null) {
  return useDoc<MerchantBank>(
    merchantId ? ["merchants", merchantId, "private", "bank"] : null,
    isFirebaseConfigured ? emptyBank : demoBank,
  );
}

const emptyContact: MerchantContact = { email: "", phone: "", crNumber: "", updatedAt: 0 };

/** Private contact + business registration details (owner and admins only). */
export function useMerchantContact(merchantId: string | null) {
  return useDoc<MerchantContact>(merchantId ? ["merchants", merchantId, "private", "contact"] : null, emptyContact);
}

/** Home page settings (settings/storefront), with defaults for anything missing. */
export function useStorefront() {
  const live = useDoc<StorefrontSettings>(["settings", "storefront"], DEFAULT_STOREFRONT);
  return { ...live, data: withStorefrontDefaults(live.data) };
}

/** Admin: every product that isn't deleted, any store, any status. */
export function useAllProducts() {
  const live = useLive<Product>(() => query(collection(db(), "products")), () => demoProducts, []);
  return { ...live, data: live.data.filter((p) => p.status !== "archived") };
}

/** Admin: the newest 500 accounts. */
export function useUsers() {
  return useLive<UserProfile & { id: string }>(
    () => query(collection(db(), "users"), orderBy("createdAt", "desc"), limit(500)),
    () => [
      { id: "admin", uid: "admin", email: "admin@memo.sa", displayName: "Memo Admin", role: "admin", createdAt: Date.now() - 90 * 86_400_000 },
      ...demoMerchants.map((m) => ({ id: m.id, uid: m.id, email: `owner@${m.slug}.sa`, displayName: m.storeName, role: "merchant" as const, createdAt: m.createdAt })),
      { id: "c0", uid: "c0", email: "noura@example.com", displayName: "Noura Al-Harbi", role: "customer", createdAt: Date.now() - 12 * 86_400_000 },
    ],
    [],
  );
}

/** Admin: the newest 200 audit entries. */
export function useAuditLogs() {
  return useLive<AuditLog>(() => query(collection(db(), "auditLogs"), orderBy("createdAt", "desc"), limit(200)), () => [], []);
}

/** Admin: every legal/policy page, edited version or built-in text. */
export function useLegalPages() {
  const live = useLive<Partial<LegalPage> & { id: string; createdAt?: number }>(() => query(collection(db(), "pages")), () => [], []);
  const data = LEGAL_SLUGS.map((slug) => withLegalDefaults(slug, live.data.find((p) => p.id === slug)));
  return { ...live, data };
}
