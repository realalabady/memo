import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError } from "@/lib/server/auth";
import { adminEmails, setRoleClaims } from "@/lib/server/roles";
import type { Merchant, Role, UserProfile } from "@/lib/types";

const schema = z.object({ displayName: z.string().trim().min(1).max(80).optional() });

/**
 * Called after every sign-in. Creates users/{uid} (in a transaction, so the
 * auth listener and signUp can race safely), promotes verified ADMIN_EMAILS,
 * and keeps custom claims in sync. Returns `claimsChanged` so the client
 * knows to refresh its ID token.
 */
export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) throw new HttpError(401, "Sign in required");
    const decoded = await adminAuth()
      .verifyIdToken(token)
      .catch(() => {
        throw new HttpError(401, "Invalid session");
      });
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    const explicitName = parsed.success ? parsed.data.displayName : undefined;

    const email = (decoded.email ?? "").toLowerCase();
    const isAdmin = Boolean(email && decoded.email_verified && adminEmails().includes(email));
    const fallbackName = decoded.name || email.split("@")[0] || "Shopper";

    const db = adminDb();
    const ref = db.collection("users").doc(decoded.uid);
    const merchantRef = db.collection("merchants").doc(decoded.uid);

    const { profile, merchantStatus } = await db.runTransaction(async (tx) => {
      const [snap, merchantSnap] = await Promise.all([tx.get(ref), tx.get(merchantRef)]);
      const merchantStatus = merchantSnap.exists ? (merchantSnap.data() as Merchant).status : null;

      if (!snap.exists) {
        const role: Role = isAdmin ? "admin" : merchantStatus === "approved" ? "merchant" : "customer";
        const profile: UserProfile = {
          uid: decoded.uid,
          email,
          displayName: explicitName || fallbackName,
          role,
          createdAt: Date.now(),
        };
        tx.set(ref, profile);
        return { profile, merchantStatus };
      }

      const profile = snap.data() as UserProfile;
      const patch: Partial<UserProfile> = {};
      // signUp sends the real name; the auth listener may have created the doc first with the fallback.
      if (explicitName && profile.displayName !== explicitName && profile.displayName === fallbackName) {
        patch.displayName = explicitName;
      }
      if (isAdmin && profile.role !== "admin") patch.role = "admin";
      if (Object.keys(patch).length) tx.update(ref, patch);
      return { profile: { ...profile, ...patch }, merchantStatus };
    });

    const claimsChanged =
      decoded.role !== profile.role || (decoded.merchantStatus ?? null) !== (merchantStatus ?? null)
        ? await setRoleClaims(decoded.uid, { role: profile.role, merchantStatus })
        : false;

    return Response.json({ profile, claimsChanged });
  } catch (err) {
    return errorResponse(err);
  }
}
