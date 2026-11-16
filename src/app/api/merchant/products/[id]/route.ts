import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError } from "@/lib/server/auth";
import { requireApprovedMerchant, revalidateCatalog } from "@/lib/server/merchant";
import { productInput } from "@/lib/server/schemas";
import type { Product } from "@/lib/types";

async function ownedProduct(id: string, merchantId: string) {
  const ref = adminDb().collection("products").doc(id);
  const snap = await ref.get();
  if (!snap.exists || (snap.data() as Product).merchantId !== merchantId) throw new HttpError(404, "Product not found");
  return ref;
}

/** Update a product (full replace of editable fields). Clearing compareAtPrice removes it. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/merchant/products/[id]">) {
  try {
    const { id } = await ctx.params;
    const { user, merchant } = await requireApprovedMerchant(req);
    const parsed = productInput.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid product");
    const { compareAtPrice, ...input } = parsed.data;

    const ref = await ownedProduct(id, user.uid);
    const category = await adminDb().collection("categories").doc(input.categoryId).get();
    if (!category.exists) throw new HttpError(400, "Pick a valid category");

    await ref.update({
      ...input,
      compareAtPrice: compareAtPrice ?? FieldValue.delete(),
      merchantName: merchant.storeName,
      merchantSlug: merchant.slug,
      updatedAt: Date.now(),
    });
    revalidateCatalog();
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Archive instead of hard-delete, so past orders keep a valid product reference. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/merchant/products/[id]">) {
  try {
    const { id } = await ctx.params;
    const { user } = await requireApprovedMerchant(req);
    const ref = await ownedProduct(id, user.uid);
    await ref.update({ status: "archived", updatedAt: Date.now() });
    revalidateCatalog();
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
