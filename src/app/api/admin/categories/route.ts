import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit, revalidateCatalog, slugify } from "@/lib/server/merchant";
import { categoryInput } from "@/lib/server/schemas";

/** Admin: create a category. Its id is its slug; an existing slug is refused, never overwritten. */
export async function POST(req: Request) {
  try {
    const admin = await requireUser(req, ["admin"]);
    const parsed = categoryInput.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid category");
    const input = parsed.data;
    // Arabic-only names keep their Arabic slug; fall back to a random one if nothing survives.
    const slug = slugify(input.name) || slugify(input.nameAr) || `c-${Date.now().toString(36)}`;

    const db = adminDb();
    const ref = db.collection("categories").doc(slug);
    await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) throw new HttpError(409, `"${input.name}" already exists`);
      const count = (await tx.get(db.collection("categories").count())).data().count;
      tx.set(ref, { ...input, slug, order: count + 1, createdAt: Date.now() });
    });
    revalidateCatalog();
    await audit(admin.uid, "admin.category.create", `categories/${slug}`, { name: input.name });
    return Response.json({ id: slug });
  } catch (err) {
    return errorResponse(err);
  }
}
