import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/merchant";
import { settingsInput } from "@/lib/server/schemas";

/** Admin: platform commission and provider fee rates (apply to new orders only). */
export async function PUT(req: Request) {
  try {
    const admin = await requireUser(req, ["admin"]);
    const parsed = settingsInput.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid settings");
    const ref = adminDb().collection("settings").doc("platform");
    const before = (await ref.get()).data() ?? null;
    await ref.set(parsed.data, { merge: true });
    await audit(admin.uid, "admin.settings.update", "settings/platform", { from: before, to: parsed.data });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
