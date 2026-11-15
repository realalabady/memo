import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { MerchantStatus, Role } from "@/lib/types";

/**
 * Roles live in two places that must agree:
 *  - Firebase custom claims (`role`, `merchantStatus`) — read by firestore.rules and requireUser without a DB hit
 *  - users/{uid}.role — read by the UI
 * Always change roles through these helpers (Admin SDK only).
 */
export interface RoleClaims {
  role: Role;
  merchantStatus?: MerchantStatus | null;
}

export async function setRoleClaims(uid: string, claims: RoleClaims) {
  const user = await adminAuth().getUser(uid);
  const current = (user.customClaims ?? {}) as Partial<RoleClaims>;
  const next = { ...current, role: claims.role, merchantStatus: claims.merchantStatus ?? null };
  const changed = current.role !== next.role || (current.merchantStatus ?? null) !== next.merchantStatus;
  if (changed) await adminAuth().setCustomUserClaims(uid, next);
  await adminDb().collection("users").doc(uid).set({ role: claims.role }, { merge: true });
  return changed;
}

/**
 * The role a user should have after a merchant status change.
 * Admins are never demoted by store status changes.
 */
export function roleForMerchantStatus(currentRole: Role, status: MerchantStatus): Role {
  if (currentRole === "admin") return "admin";
  return status === "approved" ? "merchant" : "customer";
}

export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
