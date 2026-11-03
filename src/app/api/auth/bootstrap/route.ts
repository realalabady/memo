import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError } from "@/lib/server/auth";
import type { UserProfile } from "@/lib/types";

/**
 * Called after every sign-in. Creates the users/{uid} profile and promotes
 * ADMIN_EMAILS to admin — only when the email is verified, so nobody can
 * claim the admin address by registering it first.
 */
export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) throw new HttpError(401, "Sign in required");
    const decoded = await adminAuth().verifyIdToken(token);
    const { displayName } = (await req.json().catch(() => ({}))) as { displayName?: string };

    const admins = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const email = (decoded.email ?? "").toLowerCase();
    const isAdmin = Boolean(email && decoded.email_verified && admins.includes(email));

    const ref = adminDb().collection("users").doc(decoded.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      const profile: UserProfile = {
        uid: decoded.uid,
        email,
        displayName: displayName || decoded.name || email.split("@")[0],
        role: isAdmin ? "admin" : "customer",
        createdAt: Date.now(),
      };
      await ref.set(profile);
      return Response.json(profile);
    }
    const profile = snap.data() as UserProfile;
    if (isAdmin && profile.role !== "admin") {
      await ref.update({ role: "admin" });
      profile.role = "admin";
    }
    return Response.json(profile);
  } catch (err) {
    return errorResponse(err);
  }
}
