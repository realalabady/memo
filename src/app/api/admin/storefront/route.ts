import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit, revalidateCatalog } from "@/lib/server/merchant";
import { storefrontInput } from "@/lib/server/schemas";

/** Admin: home page copy, featured picks, banner and section order (settings/storefront). */
export async function PUT(req: Request) {
  try {
    const admin = await requireUser(req, ["admin"]);
    const parsed = storefrontInput.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid storefront");
    await adminDb()
      .collection("settings")
      .doc("storefront")
      .set({ ...parsed.data, updatedAt: Date.now() });
    revalidateCatalog();
    await audit(admin.uid, "admin.storefront.update", "settings/storefront", {
      sections: parsed.data.sections.filter((s) => s.visible).map((s) => s.id),
      banner: parsed.data.banner.enabled,
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
