import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Order, Product, Review } from "@/lib/types";
import { HttpError } from "./auth";

/**
 * Reviews live at products/{productId}/reviews/{uid}: one per buyer, written only here.
 * The product keeps ratingSum / ratingCount / ratingAvg over VISIBLE reviews, updated in the same transaction.
 */
const reviewRef = (productId: string, uid: string) =>
  adminDb().collection("products").doc(productId).collection("reviews").doc(uid);

const aggregates = (sum: number, count: number) => ({
  ratingSum: Math.max(0, sum),
  ratingCount: Math.max(0, count),
  ratingAvg: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
});

/** True when the user has a paid (not refunded) order containing the product. */
export async function hasPurchased(uid: string, productId: string) {
  const snap = await adminDb()
    .collection("orders")
    .where("customerId", "==", uid)
    .where("paymentStatus", "==", "captured")
    .get();
  return snap.docs.some((d) => (d.data() as Order).items.some((i) => i.productId === productId));
}

export async function getOwnReview(uid: string, productId: string) {
  const snap = await reviewRef(productId, uid).get();
  return snap.exists ? (snap.data() as Review) : null;
}

export async function upsertReview(input: { uid: string; displayName: string; productId: string; rating: number; text: string }) {
  if (!(await hasPurchased(input.uid, input.productId))) {
    throw new HttpError(403, "Only customers who bought this product can review it");
  }
  const db = adminDb();
  const productRef = db.collection("products").doc(input.productId);
  const ref = reviewRef(input.productId, input.uid);

  return db.runTransaction(async (tx) => {
    const [productSnap, existingSnap] = await Promise.all([tx.get(productRef), tx.get(ref)]);
    if (!productSnap.exists) throw new HttpError(404, "Product not found");
    const product = productSnap.data() as Product;
    const existing = existingSnap.exists ? (existingSnap.data() as Review) : null;
    const now = Date.now();

    let sum = product.ratingSum ?? 0;
    let count = product.ratingCount ?? 0;
    if (!existing) {
      sum += input.rating;
      count += 1;
    } else if (!existing.hidden) {
      sum += input.rating - existing.rating;
    } // editing a hidden review keeps it hidden and out of the average

    const review: Review = {
      uid: input.uid,
      displayName: input.displayName,
      rating: input.rating,
      text: input.text,
      createdAt: existing?.createdAt ?? now,
      ...(existing ? { updatedAt: now } : {}),
      ...(existing?.hidden ? { hidden: true } : {}),
      ...(existing?.reply ? { reply: existing.reply } : {}),
    };
    tx.set(ref, review);
    tx.update(productRef, aggregates(sum, count));
    return review;
  });
}

/** Admin moderation: a hidden review disappears from the storefront and from the average. */
export async function setReviewHidden(productId: string, reviewUid: string, hidden: boolean) {
  const db = adminDb();
  const productRef = db.collection("products").doc(productId);
  const ref = reviewRef(productId, reviewUid);
  await db.runTransaction(async (tx) => {
    const [productSnap, snap] = await Promise.all([tx.get(productRef), tx.get(ref)]);
    if (!snap.exists || !productSnap.exists) throw new HttpError(404, "Review not found");
    const review = snap.data() as Review;
    if (Boolean(review.hidden) === hidden) return;
    const product = productSnap.data() as Product;
    const sign = hidden ? -1 : 1;
    tx.update(ref, { hidden });
    tx.update(productRef, aggregates((product.ratingSum ?? 0) + sign * review.rating, (product.ratingCount ?? 0) + sign));
  });
}

/** The store that sells the product can post one public reply (empty text removes it). */
export async function replyToReview(input: { merchantId: string; productId: string; reviewUid: string; text: string }) {
  const db = adminDb();
  const product = (await db.collection("products").doc(input.productId).get()).data() as Product | undefined;
  if (!product || product.merchantId !== input.merchantId) throw new HttpError(404, "Review not found");
  const ref = reviewRef(input.productId, input.reviewUid);
  if (!(await ref.get()).exists) throw new HttpError(404, "Review not found");
  await ref.update({ reply: input.text ? { text: input.text, at: Date.now() } : null });
}

/** Every review on a store's products, newest first (merchant dashboard). */
export async function listMerchantReviews(merchantId: string) {
  const db = adminDb();
  const products = await db.collection("products").where("merchantId", "==", merchantId).get();
  const rated = products.docs.filter((d) => ((d.data() as Product).ratingCount ?? 0) > 0 || (d.data() as Product).ratingSum !== undefined);
  const groups = await Promise.all(
    rated.map(async (d) => {
      const p = d.data() as Product;
      const reviews = await d.ref.collection("reviews").orderBy("createdAt", "desc").limit(50).get();
      return reviews.docs.map((r) => ({
        productId: d.id,
        productTitle: p.title,
        productTitleAr: p.titleAr ?? "",
        ...(r.data() as Review),
      }));
    }),
  );
  return groups.flat().sort((a, b) => b.createdAt - a.createdAt);
}
