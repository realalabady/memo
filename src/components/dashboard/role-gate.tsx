import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isAdminConfigured } from "@/lib/firebase/admin";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import type { Role } from "@/lib/types";

/**
 * Server-side guard for /admin and /merchant: verifies the httpOnly session cookie and
 * redirects anyone without the role. Renders nothing. Dashboard data itself is protected
 * by Firestore rules and role-checked API routes; the client shell guard is UX only.
 * Admins may enter the merchant area. Demo mode (no Firebase Admin) is not gated.
 */
export async function RoleGate({ role }: { role: Exclude<Role, "customer"> }) {
  if (!isAdminConfigured) return null;
  // Session checks are per request (and verifying the cookie reads the clock), never prerendered or prefetched.
  await connection();
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect(`/login?next=${encodeURIComponent(`/${role}`)}`);
  const allowed = session.role === role || (role === "merchant" && session.role === "admin");
  if (!allowed) redirect(role === "merchant" ? "/sell" : "/");
  return null;
}
