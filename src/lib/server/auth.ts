import "server-only";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Role } from "@/lib/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

/** Role from custom claims, falling back to users/{uid} for accounts created before claims existed. */
export async function roleOf(decoded: DecodedIdToken): Promise<Role> {
  const claim = decoded.role as Role | undefined;
  if (claim === "admin" || claim === "merchant" || claim === "customer") return claim;
  const snap = await adminDb().collection("users").doc(decoded.uid).get();
  return (snap.data()?.role ?? "customer") as Role;
}

/** Verifies the `Authorization: Bearer <Firebase ID token>` header. */
export async function requireUser(req: Request, roles?: Role[]) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Sign in required");
  const decoded = await adminAuth()
    .verifyIdToken(token, true)
    .catch(() => {
      throw new HttpError(401, "Invalid session");
    });
  // Role-restricted endpoints read users/{uid} so a demotion applies before the ID token (and its claims) expires.
  const role = roles
    ? (((await adminDb().collection("users").doc(decoded.uid).get()).data()?.role ?? "customer") as Role)
    : await roleOf(decoded);
  if (roles && !roles.includes(role)) throw new HttpError(403, "Not allowed");
  return { uid: decoded.uid, email: decoded.email ?? "", role, decoded };
}

/**
 * Verifies an httpOnly session cookie (set by /api/auth/session). Returns null when missing or invalid.
 * The role is read from users/{uid} (not the cookie's claims) so approvals/demotions apply immediately.
 */
export async function verifySession(cookie: string | undefined) {
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    const snap = await adminDb().collection("users").doc(decoded.uid).get();
    const role = (snap.data()?.role ?? "customer") as Role;
    return { uid: decoded.uid, email: decoded.email ?? "", role, decoded };
  } catch {
    return null;
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
