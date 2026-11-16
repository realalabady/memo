import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError } from "@/lib/server/auth";
import { batchedUpdate, requireApprovedMerchant, revalidateCatalog } from "@/lib/server/merchant";
import { merchantProfileInput } from "@/lib/server/schemas";

/** Update the public store profile. A rename is copied onto every product of the store. */
export async function PATCH(req: Request) {
  try {
    const { user, merchant } = await requireApprovedMerchant(req);
    const parsed = merchantProfileInput.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid profile");
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
    if (!Object.keys(patch).length) return Response.json({ ok: true });

    const db = adminDb();
    await db.collection("merchants").doc(user.uid).update({ ...patch, updatedAt: Date.now() });

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
