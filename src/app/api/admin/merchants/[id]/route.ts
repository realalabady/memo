import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit, revalidateCatalog } from "@/lib/server/merchant";
import { roleForMerchantStatus, setRoleClaims } from "@/lib/server/roles";
import type { Merchant, Role } from "@/lib/types";

const schema = z
  .object({
    status: z.enum(["pending", "approved", "suspended", "rejected"]).optional(),
    /** Shown to the store owner; required when rejecting */
    rejectionReason: z.string().trim().min(3).max(300).optional(),
    /** null = use the platform default */
    commissionRate: z.number().min(0).max(0.5).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.commissionRate !== undefined, "Nothing to change")
  .refine((v) => v.status !== "rejected" || Boolean(v.rejectionReason), "Give the reason for the rejection");

/** Admin: approve/suspend a store and/or set its commission. Keeps the owner's role + claims in sync. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/merchants/[id]">) {
  try {
    const { id } = await ctx.params;
    const admin = await requireUser(req, ["admin"]);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid change");
    const { status, commissionRate, rejectionReason } = parsed.data;

    const db = adminDb();
    const ref = db.collection("merchants").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "Store not found");
    const before = snap.data() as Merchant;

    await ref.update({
      ...(status !== undefined ? { status, rejectionReason: status === "rejected" ? rejectionReason : FieldValue.delete() } : {}),
      ...(commissionRate !== undefined ? { commissionRate } : {}),
      updatedAt: Date.now(),
    });

    if (status !== undefined && status !== before.status) {
      const userSnap = await db.collection("users").doc(id).get();
      const currentRole = (userSnap.data()?.role ?? "customer") as Role;
      await setRoleClaims(id, { role: roleForMerchantStatus(currentRole, status), merchantStatus: status });
      revalidateCatalog(); // store pages and its products appear/disappear
    }

    await audit(admin.uid, "admin.merchant.update", `merchants/${id}`, {
      from: { status: before.status, commissionRate: before.commissionRate ?? null },
      to: { status, commissionRate, rejectionReason: rejectionReason ?? null },
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
