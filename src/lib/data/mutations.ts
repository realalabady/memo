"use client";

import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, isFirebaseConfigured, storage } from "@/lib/firebase/client";
import type {
  Category,
  FulfillmentStatus,
  Merchant,
  MerchantBank,
  MerchantStatus,
  PlatformSettings,
  Product,
} from "@/lib/types";

/**
 * Writes from the dashboards. Anything touching money, roles, store identity or
 * products goes through a role-checked API route (Admin SDK) — Firestore rules
 * deny those writes from the client. Only uploads and admin categories write directly.
 */
export class DemoModeError extends Error {
  constructor() {
    super("Demo mode — connect Firebase in .env.local to save changes");
  }
}

function guard() {
  if (!isFirebaseConfigured) throw new DemoModeError();
}

async function api(url: string, method: string, body?: unknown) {
  guard();
  const token = await auth().currentUser?.getIdToken();
  if (!token) throw new Error("Please sign in again");
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

export async function uploadImage(path: string, file: File) {
  guard();
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") throw new Error("Please choose a JPG, PNG or WebP image");
  if (file.size > 5 * 1024 * 1024) throw new Error("Images must be under 5 MB");
  const r = ref(storage(), `${path}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "")}`);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}

type ProductFields = Pick<Product, "title" | "description" | "price" | "images" | "categoryId" | "stock"> & {
  titleAr?: string;
  descriptionAr?: string;
  status: "active" | "draft";
  compareAtPrice?: number | null;
};

/** Store identity (merchantId/name/slug) is set by the server from your account. */
export async function saveProduct(id: string | null, data: ProductFields) {
  const body: ProductFields = {
    title: data.title,
    titleAr: data.titleAr ?? "",
    description: data.description,
    descriptionAr: data.descriptionAr ?? "",
    price: data.price,
    compareAtPrice: data.compareAtPrice ?? null,
    images: data.images,
    categoryId: data.categoryId,
    stock: data.stock,
    status: data.status === "active" ? "active" : "draft",
  };
  if (id) await api(`/api/merchant/products/${id}`, "PATCH", body);
  else await api("/api/merchant/products", "POST", body);
}

export async function deleteProduct(id: string) {
  await api(`/api/merchant/products/${id}`, "DELETE");
}

export async function setFulfillment(merchantOrderId: string, status: FulfillmentStatus, trackingNumber?: string) {
  if (status === "pending") throw new Error("Orders can't move back to pending");
  await api(`/api/merchant/orders/${merchantOrderId}/fulfillment`, "POST", { status, trackingNumber });
}

/** The slug is generated (and reserved) by the server; any slug passed here is ignored. */
export async function applyAsMerchant(
  _uid: string,
  data: Pick<Merchant, "storeName" | "tagline" | "bio" | "city" | "phone"> & Partial<Pick<Merchant, "slug" | "email">>,
) {
  await api("/api/merchant/apply", "POST", {
    storeName: data.storeName,
    tagline: data.tagline,
    bio: data.bio,
    city: data.city,
    phone: data.phone,
  });
}

export async function updateMerchantProfile(
  _uid: string,
  data: Partial<Pick<Merchant, "storeName" | "tagline" | "bio" | "city" | "phone" | "logoUrl" | "bannerUrl">>,
) {
  await api("/api/merchant/profile", "PATCH", data);
}

export async function saveMerchantBank(_uid: string, bank: Omit<MerchantBank, "updatedAt">) {
  await api("/api/merchant/bank", "PUT", bank);
}

/** Admin: approve / suspend a store. The server keeps the owner's role in sync and never demotes admins. */
export async function setMerchantStatus(uid: string, status: MerchantStatus) {
  await api(`/api/admin/merchants/${uid}`, "PATCH", { status });
}

export async function setMerchantCommission(uid: string, rate: number | null) {
  await api(`/api/admin/merchants/${uid}`, "PATCH", { commissionRate: rate });
}

export async function saveCategory(cat: Category) {
  guard();
  const { id, ...rest } = cat;
  await setDoc(doc(db(), "categories", id), rest);
}

export async function deleteCategory(id: string) {
  guard();
  await deleteDoc(doc(db(), "categories", id));
}

export async function saveSettings(settings: PlatformSettings) {
  await api("/api/admin/settings", "PUT", settings);
}

/** Admin: refund one store's part of a paid order (or the whole order when no rows are given). */
export async function refundOrder(orderId: string, reason: string, merchantOrderIds?: string[]) {
  return (await api(`/api/admin/orders/${orderId}/refund`, "POST", { reason, merchantOrderIds })) as { amount?: number };
}

/** Admin: keep an order out of payouts during a dispute, or release it. */
export async function setPayoutHold(merchantOrderId: string, hold: boolean) {
  await api(`/api/admin/merchant-orders/${merchantOrderId}/hold`, "POST", { hold });
}
