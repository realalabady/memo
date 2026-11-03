import "server-only";
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

/** Verifies the `Authorization: Bearer <Firebase ID token>` header. */
export async function requireUser(req: Request, roles?: Role[]) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Sign in required");
  const decoded = await adminAuth()
    .verifyIdToken(token)
    .catch(() => {
      throw new HttpError(401, "Invalid session");
    });
  const snap = await adminDb().collection("users").doc(decoded.uid).get();
  const role = (snap.data()?.role ?? "customer") as Role;
  if (roles && !roles.includes(role)) throw new HttpError(403, "Not allowed");
  return { uid: decoded.uid, email: decoded.email ?? "", role, decoded };
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
