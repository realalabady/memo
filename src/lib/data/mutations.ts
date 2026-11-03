"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, isFirebaseConfigured, storage } from "@/lib/firebase/client";
import type {
  Category,
  FulfillmentStatus,
  Merchant,
  MerchantBank,
  MerchantStatus,
  PlatformSettings,
  Product,
} from "@/lib/types";

export class DemoModeError extends Error {
  constructor() {
    super("Demo mode — connect Firebase in .env.local to save changes");
  }
}

function guard() {
  if (!isFirebaseConfigured) throw new DemoModeError();
}

export async function uploadImage(path: string, file: File) {
  guard();
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image");
  if (file.size > 5 * 1024 * 1024) throw new Error("Images must be under 5 MB");
  const r = ref(storage(), `${path}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "")}`);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}

export async function saveProduct(id: string | null, data: Omit<Product, "id">) {
  guard();
  if (id) await updateDoc(doc(db(), "products", id), { ...data });
  else await addDoc(collection(db(), "products"), data);
}

export async function deleteProduct(id: string) {
  guard();
  await deleteDoc(doc(db(), "products", id));
}

export async function setFulfillment(merchantOrderId: string, status: FulfillmentStatus, trackingNumber?: string) {
  guard();
  await updateDoc(doc(db(), "merchantOrders", merchantOrderId), {
    fulfillmentStatus: status,
    ...(trackingNumber !== undefined ? { trackingNumber } : {}),
    updatedAt: Date.now(),
  });
}

export async function applyAsMerchant(uid: string, data: Pick<Merchant, "storeName" | "slug" | "tagline" | "bio" | "city" | "phone" | "email">) {
  guard();
  await setDoc(doc(db(), "merchants", uid), { ...data, status: "pending", createdAt: Date.now() });
}

export async function updateMerchantProfile(uid: string, data: Partial<Pick<Merchant, "storeName" | "tagline" | "bio" | "city" | "phone" | "logoUrl" | "bannerUrl">>) {
  guard();
  await updateDoc(doc(db(), "merchants", uid), data);
}

export async function saveMerchantBank(uid: string, bank: Omit<MerchantBank, "updatedAt">) {
  guard();
  await setDoc(doc(db(), "merchants", uid, "private", "bank"), { ...bank, updatedAt: Date.now() });
}

/** Admin: approve / suspend a merchant, and keep the user's role in sync. */
export async function setMerchantStatus(uid: string, status: MerchantStatus) {
  guard();
  const batch = writeBatch(db());
  batch.update(doc(db(), "merchants", uid), { status });
  batch.set(doc(db(), "users", uid), { role: status === "approved" ? "merchant" : "customer" }, { merge: true });
  await batch.commit();
}

export async function setMerchantCommission(uid: string, rate: number | null) {
  guard();
  await updateDoc(doc(db(), "merchants", uid), { commissionRate: rate ?? null });
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
  guard();
  await setDoc(doc(db(), "settings", "platform"), settings);
}
