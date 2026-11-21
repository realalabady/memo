import { timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import { settleOrExpire } from "@/lib/server/orders";
import type { Order } from "@/lib/types";

/**
 * Releases stock held by abandoned checkouts. Schedule every 10–15 minutes
 * (Cloud Scheduler on App Hosting, vercel.json on Vercel) with `Authorization: Bearer $CRON_SECRET`.
 * Each order is re-checked with Tabby/Tamara first, so a paid order is never expired.
 */
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || !got) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const snap = await adminDb()
    .collection("orders")
    .where("paymentStatus", "==", "pending")
    .where("reservedUntil", "<", Date.now())
    .limit(100)
    .get();

  const results = { captured: 0, failed: 0, pending: 0 };
  for (const d of snap.docs) {
    results[await settleOrExpire({ id: d.id, ...d.data() } as Order)]++;
  }
  return Response.json({ checked: snap.size, ...results });
}
