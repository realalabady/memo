import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { adminBucket, adminDb } from "@/lib/firebase/admin";
import type { Merchant } from "@/lib/types";
import { HttpError, requireUser } from "./auth";

/** Authenticated caller who owns an APPROVED store. */
export async function requireApprovedMerchant(req: Request) {
  const user = await requireUser(req);
  const snap = await adminDb().collection("merchants").doc(user.uid).get();
  if (!snap.exists) throw new HttpError(403, "You don't have a store yet");
  const merchant = { id: snap.id, ...snap.data() } as Merchant;
  if (merchant.status !== "approved") throw new HttpError(403, "Your store isn't approved");
  return { user, merchant };
}

/** Expire storefront caches immediately (route handlers can't use updateTag). */
export function revalidateCatalog() {
  revalidateTag("catalog", { expire: 0 });
}

/**
 * Stock moved (checkout reservation, failed/expired payment, refund): product pages and the bag
 * re-check read the cached catalog, so refresh it. Outside a Next request (scripts, tests) there is
 * no cache to refresh, so that case is skipped.
 */
export function stockChanged() {
  try {
    revalidateCatalog();
  } catch (err) {
    if (!(err instanceof Error && /static generation store|outside a request|Invariant/i.test(err.message))) throw err;
  }
}

/** Append-only trail of privileged changes (admin actions, bank detail edits). */
export async function audit(actorUid: string, action: string, target: string, data: Record<string, unknown> = {}) {
  // Firestore rejects undefined values; optional fields left out of a change simply drop from the entry.
  const clean = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  await adminDb()
    .collection("auditLogs")
    .add({ actorUid, action, target, data: clean, createdAt: Date.now(), at: FieldValue.serverTimestamp() });
}

/** Firestore batches hold 500 writes; chunk large fan-out updates. */
export async function batchedUpdate(
  refs: FirebaseFirestore.DocumentReference[],
  data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>,
) {
  const db = adminDb();
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + 400)) batch.update(ref, data);
    await batch.commit();
  }
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

/**
 * Best-effort removal of uploaded images that are no longer referenced.
 * Only touches objects under `prefix` (the caller's own folder), so a crafted URL can't delete someone else's file.
 */
export async function deleteStoredImages(urls: string[], prefix: string) {
  const bucket = adminBucket();
  if (!bucket) return;
  await Promise.all(
    urls.map(async (url) => {
      const match = /\/o\/([^?]+)/.exec(url);
      const path = match ? decodeURIComponent(match[1]) : "";
      if (!path.startsWith(prefix)) return;
      await bucket.file(path).delete({ ignoreNotFound: true }).catch((err) => console.error("image cleanup failed", path, err));
    }),
  );
}
