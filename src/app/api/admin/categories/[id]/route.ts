import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit, batchedUpdate, revalidateCatalog } from "@/lib/server/merchant";
import { categoryInput } from "@/lib/server/schemas";

async function existing(id: string) {
  const ref = adminDb().collection("categories").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Category not found");
  return ref;
}

/** Admin: edit a category's names, blurbs and image. The slug never changes, so links keep working. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/categories/[id]">) {
  try {
    const { id } = await ctx.params;
    const admin = await requireUser(req, ["admin"]);
    const parsed = categoryInput.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid category");
    const ref = await existing(id);
    await ref.update({ ...parsed.data, updatedAt: Date.now() });
    revalidateCatalog();
    await audit(admin.uid, "admin.category.update", `categories/${id}`, { name: parsed.data.name });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

const deleteInput = z.object({ moveTo: z.string().trim().min(1).max(80).optional() });

/**
 * Admin: delete a category. Refused (409 + count) while products are filed under it,
 * unless `moveTo` names another category to move them to first.
 */
export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/categories/[id]">) {
  try {
    const { id } = await ctx.params;
    const admin = await requireUser(req, ["admin"]);
    const parsed = deleteInput.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, "Invalid request");
    const { moveTo } = parsed.data;
    const db = adminDb();
    const ref = await existing(id);

    // Archived products don't count: they only keep past orders readable.
    const products = await db.collection("products").where("categoryId", "==", id).where("status", "in", ["active", "draft"]).select().get();
    if (products.size > 0) {
      if (!moveTo) {
        return Response.json({ error: `${products.size} products are filed under this category. Move them first.`, count: products.size }, { status: 409 });
      }
      if (moveTo === id) throw new HttpError(400, "Pick a different category");
      await existing(moveTo);
      await batchedUpdate(products.docs.map((d) => d.ref), { categoryId: moveTo, updatedAt: Date.now() });
    }
    await ref.delete();

    // Drop it from the home page picks too.
    const sfRef = db.collection("settings").doc("storefront");
    const featured = (await sfRef.get()).data()?.featuredCategoryIds;
    if (Array.isArray(featured) && featured.includes(id)) {
      await sfRef.update({ featuredCategoryIds: featured.filter((c: string) => c !== id) });
    }
    revalidateCatalog();
    await audit(admin.uid, "admin.category.delete", `categories/${id}`, { moved: products.size, moveTo: moveTo ?? null });
    return Response.json({ ok: true, moved: products.size });
  } catch (err) {
    return errorResponse(err);
  }
}
