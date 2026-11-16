import "server-only";
import { createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Audit log + de-duplication for provider webhooks (collection `paymentEvents`).
 * Providers retry deliveries; an event that was already processed successfully is skipped.
 * A failed event is recorded with its error and runs again on the provider's next retry.
 */
export async function handleOnce(
  provider: "tabby" | "tamara",
  key: string,
  payload: unknown,
  work: () => Promise<void>,
): Promise<"processed" | "duplicate"> {
  const id = `${provider}_${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
  const ref = adminDb().collection("paymentEvents").doc(id);
  const existing = await ref.get();
  if (existing.exists && existing.data()?.processedAt) return "duplicate";

  const base = { provider, key, payload: JSON.parse(JSON.stringify(payload ?? null)), receivedAt: Date.now() };
  try {
    await work();
    await ref.set({ ...base, processedAt: Date.now(), error: null }, { merge: true });
    return "processed";
  } catch (err) {
    await ref.set({ ...base, processedAt: null, error: String(err) }, { merge: true }).catch(() => {});
    throw err;
  }
}
