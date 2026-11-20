import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit, revalidateCatalog } from "@/lib/server/merchant";
import type { Product } from "@/lib/types";

const schema = z
  .object({ hidden: z.boolean(), reason: z.string().trim().min(3).max(300).optional() })
  .refine((v) => !v.hidden || Boolean(v.reason), "Give the reason; the store will see it");

/**
 * Admin moderation: unpublish a product (it becomes a draft the store can't republish)
 * or release it (its previous status comes back).
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/products/[id]">) {
  try {
    const { id } = await ctx.params;
    const admin = await requireUser(req, ["admin"]);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const { hidden, reason } = parsed.data;

    const db = adminDb();
    const ref = db.collection("products").doc(id);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, "Product not found");
      const p = snap.data() as Product;
      if (p.status === "archived") throw new HttpError(409, "This product was deleted by its store");
      if (hidden) {
        tx.update(ref, {
          hiddenByAdmin: true,
          hiddenReason: reason,
          statusBeforeHide: p.hiddenByAdmin ? (p.statusBeforeHide ?? "draft") : p.status,
          status: "draft",
          updatedAt: Date.now(),
        });
      } else if (p.hiddenByAdmin) {
        tx.update(ref, {
          hiddenByAdmin: FieldValue.delete(),
          hiddenReason: FieldValue.delete(),
          statusBeforeHide: FieldValue.delete(),
          status: p.statusBeforeHide ?? "draft",
          updatedAt: Date.now(),
        });
      }
    });
    revalidateCatalog();
    await audit(admin.uid, hidden ? "admin.product.hide" : "admin.product.release", `products/${id}`, { reason: reason ?? null });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
