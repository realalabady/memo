import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/merchant";
import { adminEmails, setRoleClaims } from "@/lib/server/roles";
import type { MerchantStatus } from "@/lib/types";

const schema = z
  .object({ admin: z.boolean().optional(), disabled: z.boolean().optional() })
  .refine((v) => v.admin !== undefined || v.disabled !== undefined, "Nothing to change");

/**
 * Admin: grant/remove the admin role, or disable/enable an account.
 * Store owners keep their merchant role when admin is removed. Nobody can change their own account here.
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  try {
    const { id } = await ctx.params;
    const actor = await requireUser(req, ["admin"]);
    if (id === actor.uid) throw new HttpError(400, "You can't change your own account here");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid change");
    const { admin, disabled } = parsed.data;

    const user = await adminAuth()
      .getUser(id)
      .catch(() => {
        throw new HttpError(404, "User not found");
      });
    const db = adminDb();
    const merchantStatus = ((await db.collection("merchants").doc(id).get()).data()?.status ?? null) as MerchantStatus | null;

    if (admin !== undefined) {
      if (!admin && user.email && adminEmails().includes(user.email.toLowerCase())) {
        throw new HttpError(409, "This admin is listed in ADMIN_EMAILS; remove them there first");
      }
      const role = admin ? "admin" : merchantStatus === "approved" ? "merchant" : "customer";
      await setRoleClaims(id, { role, merchantStatus });
      await adminAuth().revokeRefreshTokens(id); // the new role applies from their next sign-in
    }
    if (disabled !== undefined) {
      await adminAuth().updateUser(id, { disabled });
      if (disabled) await adminAuth().revokeRefreshTokens(id);
      await db.collection("users").doc(id).set({ disabled }, { merge: true });
    }
    await audit(actor.uid, "admin.user.update", `users/${id}`, { admin: admin ?? null, disabled: disabled ?? null });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
