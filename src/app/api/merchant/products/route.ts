import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError } from "@/lib/server/auth";
import { requireApprovedMerchant, revalidateCatalog } from "@/lib/server/merchant";
import { productInput } from "@/lib/server/schemas";
import type { Product } from "@/lib/types";

/** Create a product. Store identity fields come from the caller's merchant doc, never the request. */
export async function POST(req: Request) {
  try {
    const { user, merchant } = await requireApprovedMerchant(req);
    const parsed = productInput.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid product");
    const input = parsed.data;

    const db = adminDb();
    const category = await db.collection("categories").doc(input.categoryId).get();
    if (!category.exists) throw new HttpError(400, "Pick a valid category");

    const ref = db.collection("products").doc();
    const product: Omit<Product, "id"> = {
      ...input,
      compareAtPrice: input.compareAtPrice ?? undefined,
      merchantId: user.uid,
      merchantName: merchant.storeName,
      merchantSlug: merchant.slug,
      createdAt: Date.now(),
    };
    await ref.set(JSON.parse(JSON.stringify(product))); // drop undefined fields
    revalidateCatalog();
    return Response.json({ id: ref.id });
  } catch (err) {
    return errorResponse(err);
  }
}
