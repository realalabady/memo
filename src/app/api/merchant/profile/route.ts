import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError } from "@/lib/server/auth";
import { batchedUpdate, requireApprovedMerchant, revalidateCatalog } from "@/lib/server/merchant";
import { merchantProfileInput } from "@/lib/server/schemas";

/**
 * Update the store profile. Public fields go on merchants/{uid}; the phone number is private
 * (merchants/{uid}/private/contact). A rename is copied onto every product of the store.
 */
export async function PATCH(req: Request) {
  try {
    const { user, merchant } = await requireApprovedMerchant(req);
    const parsed = merchantProfileInput.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid profile");
    const { phone, ...publicFields } = parsed.data;
    const patch = Object.fromEntries(Object.entries(publicFields).filter(([, v]) => v !== undefined));

    const db = adminDb();
    const ref = db.collection("merchants").doc(user.uid);
    // Older store docs kept email/phone publicly — move them out on the next save.
    await ref.update({ ...patch, email: FieldValue.delete(), phone: FieldValue.delete(), updatedAt: Date.now() });
    if (phone !== undefined) {
      await ref.collection("private").doc("contact").set({ phone, email: user.email, updatedAt: Date.now() }, { merge: true });
    }

    if (patch.storeName && patch.storeName !== merchant.storeName) {
      const products = await db.collection("products").where("merchantId", "==", user.uid).select().get();
      await batchedUpdate(
        products.docs.map((d) => d.ref),
        { merchantName: patch.storeName },
      );
    }
    revalidateCatalog();
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
