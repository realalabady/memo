import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { isLegalSlug } from "@/lib/legal";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit, revalidateCatalog } from "@/lib/server/merchant";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  titleAr: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(30_000),
  bodyAr: z.string().trim().min(1).max(30_000),
});

/** Admin: publish a legal/policy page (terms, privacy, returns, shipping, merchant terms). */
export async function PUT(req: Request, ctx: RouteContext<"/api/admin/pages/[slug]">) {
  try {
    const { slug } = await ctx.params;
    if (!isLegalSlug(slug)) throw new HttpError(404, "Unknown page");
    const admin = await requireUser(req, ["admin"]);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid page");
    await adminDb()
      .collection("pages")
      .doc(slug)
      .set({ ...parsed.data, slug, updatedAt: Date.now(), updatedBy: admin.uid });
    revalidateCatalog();
    await audit(admin.uid, "admin.page.update", `pages/${slug}`, { title: parsed.data.title });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Admin: drop the edited version so the built-in text shows again. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/pages/[slug]">) {
  try {
    const { slug } = await ctx.params;
    if (!isLegalSlug(slug)) throw new HttpError(404, "Unknown page");
    const admin = await requireUser(req, ["admin"]);
    await adminDb().collection("pages").doc(slug).delete();
    revalidateCatalog();
    await audit(admin.uid, "admin.page.reset", `pages/${slug}`);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
