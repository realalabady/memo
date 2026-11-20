import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit, revalidateCatalog } from "@/lib/server/merchant";

const schema = z.object({ ids: z.array(z.string().trim().min(1).max(80)).min(1).max(200) });

/** Admin: set the category order (ids first to last). */
export async function POST(req: Request) {
  try {
    const admin = await requireUser(req, ["admin"]);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Invalid order");
    const ids = [...new Set(parsed.data.ids)];
    const db = adminDb();
    const snaps = await db.getAll(...ids.map((id) => db.collection("categories").doc(id)));
    if (snaps.some((s) => !s.exists)) throw new HttpError(400, "Unknown category in the list");
    const batch = db.batch();
    snaps.forEach((s, i) => batch.update(s.ref, { order: i + 1 }));
    await batch.commit();
    revalidateCatalog();
    await audit(admin.uid, "admin.category.reorder", "categories", { ids });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
