import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { slugify } from "@/lib/server/merchant";
import { merchantApplyInput } from "@/lib/server/schemas";
import type { Merchant } from "@/lib/types";

/** Apply to sell. Creates merchants/{uid} as pending and reserves a unique slug in slugs/{slug}. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = merchantApplyInput.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Please complete the form");
    const input = parsed.data;

    const db = adminDb();
    const base = slugify(input.storeName) || "store";
    const merchantRef = db.collection("merchants").doc(user.uid);

    const slug = await db.runTransaction(async (tx) => {
      const existing = await tx.get(merchantRef);
      if (existing.exists) throw new HttpError(409, "You already have a store application");

      // Try the plain name, then name + uid prefix, then a random suffix.
      const candidates = [base, `${base}-${user.uid.slice(0, 4).toLowerCase()}`, `${base}-${crypto.randomUUID().slice(0, 6)}`];
      for (const candidate of candidates) {
        const slugRef = db.collection("slugs").doc(candidate);
        if ((await tx.get(slugRef)).exists) continue;
        const merchant: Omit<Merchant, "id"> = {
          ...input,
          slug: candidate,
          email: user.email,
          status: "pending",
          createdAt: Date.now(),
        };
        tx.set(merchantRef, JSON.parse(JSON.stringify(merchant)));
        tx.set(slugRef, { merchantId: user.uid });
        return candidate;
      }
      throw new HttpError(409, "That store name is taken — try another");
    });
    return Response.json({ ok: true, slug });
  } catch (err) {
    return errorResponse(err);
  }
}
