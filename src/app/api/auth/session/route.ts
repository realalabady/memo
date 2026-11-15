import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { errorResponse, HttpError, SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/server/auth";

/** Exchange a fresh Firebase ID token for an httpOnly session cookie (used by server-gated dashboards). */
export async function POST(req: Request) {
  try {
    const header = req.headers.get("authorization") ?? "";
    const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!idToken) throw new HttpError(401, "Sign in required");
    await adminAuth()
      .verifyIdToken(idToken, true)
      .catch(() => {
        throw new HttpError(401, "Invalid session");
      });
    const session = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
    (await cookies()).set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
