import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { HttpError } from "./auth";

/**
 * Fixed-window request counter in Firestore (rateLimits/{bucket}_{key}_{window}).
 * Throws 429 once `limit` requests were made in the current window.
 * Set a Firestore TTL policy on rateLimits.expireAt so old counters are deleted automatically.
 */
export async function rateLimit(bucket: string, key: string, limit: number, windowSeconds = 60) {
  if (!isAdminConfigured) return; // demo mode has no database
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const ref = adminDb().collection("rateLimits").doc(`${bucket}_${key}_${windowStart}`);
  const count = await adminDb().runTransaction(async (tx) => {
    const n = ((await tx.get(ref)).data()?.count as number | undefined) ?? 0;
    if (n >= limit) return n + 1;
    tx.set(ref, { bucket, key, count: n + 1, expireAt: Timestamp.fromMillis((windowStart + windowSeconds * 2) * 1000) });
    return n + 1;
  });
  if (count > limit) {
    const retry = windowStart + windowSeconds - Math.floor(Date.now() / 1000);
    throw new HttpError(429, `Too many requests. Try again in ${Math.max(1, retry)} seconds.`);
  }
}
