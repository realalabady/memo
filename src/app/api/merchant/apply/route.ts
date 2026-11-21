import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { slugify } from "@/lib/server/merchant";
import { setRoleClaims } from "@/lib/server/roles";
import { merchantApplyInput } from "@/lib/server/schemas";
import { MERCHANT_TERMS_VERSION, type Merchant, type MerchantContact, type Role } from "@/lib/types";

/**
 * Apply to sell (or re-apply after a rejection).
 * Public store doc: merchants/{uid} (pending, unique slug reserved in slugs/{slug}).
 * Contact + business registration details: merchants/{uid}/private/contact (owner + admin only).
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    await rateLimit("apply", user.uid, 5);
    if (!user.decoded.email_verified) throw new HttpError(403, "Verify your email address before applying");
    const parsed = merchantApplyInput.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Please complete the form");
    const { phone, businessType, crNumber, freelanceNumber, vatNumber, acceptTerms: _accepted, ...store } = parsed.data;
    void _accepted;

    const db = adminDb();
    const base = slugify(store.storeName) || "store";
    const merchantRef = db.collection("merchants").doc(user.uid);
    const now = Date.now();
    // Only the number that matches the chosen business type is kept; "none" stores neither (nor VAT).
    const contact: MerchantContact = {
      email: user.email,
      phone,
      businessType,
      ...(businessType === "cr" ? { crNumber } : {}),
      ...(businessType === "freelance" ? { freelanceNumber: `FL-${freelanceNumber.replace(/^FL-?/, "")}` } : {}),
      ...(businessType !== "none" && vatNumber ? { vatNumber } : {}),
      updatedAt: now,
    };
    const terms = { termsAcceptedAt: now, termsVersion: MERCHANT_TERMS_VERSION };

    const slug = await db.runTransaction(async (tx) => {
      const existing = await tx.get(merchantRef);
      const current = existing.exists ? (existing.data() as Merchant) : null;
      if (current && current.status !== "rejected") throw new HttpError(409, "You already have a store application");

      if (current) {
        // Re-application: keep the reserved slug and original date, go back to review.
        tx.update(merchantRef, {
          ...JSON.parse(JSON.stringify(store)),
          ...terms,
          status: "pending",
          rejectionReason: FieldValue.delete(),
          updatedAt: now,
        });
        tx.set(merchantRef.collection("private").doc("contact"), contact);
        return current.slug;
      }

      // Try the plain name, then name + uid prefix, then a random suffix.
      const candidates = [base, `${base}-${user.uid.slice(0, 4).toLowerCase()}`, `${base}-${crypto.randomUUID().slice(0, 6)}`];
      for (const candidate of candidates) {
        const slugRef = db.collection("slugs").doc(candidate);
        if ((await tx.get(slugRef)).exists) continue;
        const merchant: Omit<Merchant, "id"> = { ...store, ...terms, slug: candidate, status: "pending", createdAt: now };
        tx.set(merchantRef, JSON.parse(JSON.stringify(merchant)));
        tx.set(merchantRef.collection("private").doc("contact"), contact);
        tx.set(slugRef, { merchantId: user.uid });
        return candidate;
      }
      throw new HttpError(409, "That store name is taken — try another");
    });

    const role = ((await db.collection("users").doc(user.uid).get()).data()?.role ?? "customer") as Role;
    await setRoleClaims(user.uid, { role, merchantStatus: "pending" });
    return Response.json({ ok: true, slug });
  } catch (err) {
    return errorResponse(err);
  }
}
