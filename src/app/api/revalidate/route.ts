import { revalidateTag } from "next/cache";
import { errorResponse, requireUser } from "@/lib/server/auth";

/** Merchants/admins call this after editing products or categories so the storefront refreshes. */
export async function POST(req: Request) {
  try {
    await requireUser(req, ["merchant", "admin"]);
    revalidateTag("catalog", "max");
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
