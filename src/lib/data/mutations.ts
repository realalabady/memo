"use client";

import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, isFirebaseConfigured, storage } from "@/lib/firebase/client";
import type { LegalPage, LegalSlug } from "@/lib/legal";
import type {
  Address,
  Category,
  FulfillmentStatus,
  Merchant,
  MerchantBank,
  MerchantStatus,
  PlatformSettings,
  Product,
  StorefrontSettings,
} from "@/lib/types";

/**
 * Writes from the dashboards. Anything touching money, roles, store identity or
 * products goes through a role-checked API route (Admin SDK) — Firestore rules
 * deny those writes from the client. Only uploads and the shopper's own profile/addresses write directly.
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
  data: { storeName: string; tagline?: string; bio?: string; city: string; phone: string; crNumber: string; vatNumber?: string; acceptTerms: boolean },
) {
  await api("/api/merchant/apply", "POST", data);
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
export async function setMerchantStatus(uid: string, status: MerchantStatus, rejectionReason?: string) {
  await api(`/api/admin/merchants/${uid}`, "PATCH", { status, rejectionReason });
}

export async function setMerchantCommission(uid: string, rate: number | null) {
  await api(`/api/admin/merchants/${uid}`, "PATCH", { commissionRate: rate });
}

type CategoryFields = Pick<Category, "name" | "nameAr" | "blurb" | "blurbAr" | "image">;

/** Admin: categories go through the API (unique slugs, safe delete, cache refresh). */
export async function createCategory(cat: CategoryFields) {
  return (await api("/api/admin/categories", "POST", cat)) as { id: string };
}

export async function updateCategory(id: string, cat: CategoryFields) {
  await api(`/api/admin/categories/${id}`, "PATCH", cat);
}

/** Refused while products are filed under it, unless `moveTo` names where they go. */
export async function deleteCategory(id: string, moveTo?: string) {
  await api(`/api/admin/categories/${id}`, "DELETE", moveTo ? { moveTo } : {});
}

export async function reorderCategories(ids: string[]) {
  await api("/api/admin/categories/reorder", "POST", { ids });
}

export async function saveStorefront(sf: Omit<StorefrontSettings, "updatedAt">) {
  await api("/api/admin/storefront", "PUT", sf);
}

/** Admin moderation: unpublish a product (with a reason the store sees) or release it. */
export async function setProductHidden(id: string, hidden: boolean, reason?: string) {
  await api(`/api/admin/products/${id}`, "PATCH", { hidden, reason });
}

export async function updateUserAccess(uid: string, change: { admin?: boolean; disabled?: boolean }) {
  await api(`/api/admin/users/${uid}`, "PATCH", change);
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

/** Shopper: name and mobile on their own profile (rules allow only these two fields). */
export async function updateOwnProfile(uid: string, data: { displayName: string; phone: string }) {
  guard();
  await updateDoc(doc(db(), "users", uid), { displayName: data.displayName.trim().slice(0, 80), phone: data.phone.trim().slice(0, 20) });
}

/** Shopper: address book (users/{uid}/addresses). */
export async function saveAddress(uid: string, address: Address & { label?: string }) {
  guard();
  const clean = Object.fromEntries(Object.entries(address).filter(([, v]) => typeof v === "string" && v.trim() !== "").map(([k, v]) => [k, String(v).trim()]));
  await addDoc(collection(db(), "users", uid, "addresses"), { ...clean, createdAt: Date.now() });
}

export async function deleteAddress(uid: string, id: string) {
  guard();
  await deleteDoc(doc(db(), "users", uid, "addresses", id));
}

/** Authenticated GET for admin JSON/CSV endpoints. */
export async function adminGet(url: string) {
  guard();
  const token = await auth().currentUser?.getIdToken();
  if (!token) throw new Error("Please sign in again");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong");
  return res;
}

/** Admin: publish a legal/policy page, or restore its built-in text. */
export async function saveLegalPage(slug: LegalSlug, page: Pick<LegalPage, "title" | "titleAr" | "body" | "bodyAr">) {
  await api(`/api/admin/pages/${slug}`, "PUT", { title: page.title, titleAr: page.titleAr, body: page.body, bodyAr: page.bodyAr });
}

export async function resetLegalPage(slug: LegalSlug) {
  await api(`/api/admin/pages/${slug}`, "DELETE");
}
