import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { revalidateCatalog } from "@/lib/server/merchant";
import { getOwnReview, hasPurchased, setReviewHidden, upsertReview } from "@/lib/server/reviews";

const schema = z.object({
  productId: z.string().min(1).max(80),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(1500).default(""),
});

/** Can the signed-in shopper review this product, and what did they write before? */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const productId = new URL(req.url).searchParams.get("productId") ?? "";
    if (!productId) throw new HttpError(400, "Missing product");
    const [eligible, review] = await Promise.all([hasPurchased(user.uid, productId), getOwnReview(user.uid, productId)]);
    return Response.json({ eligible, review });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Create or edit your review. Only verified buyers. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    await rateLimit("review", user.uid, 10);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Pick 1 to 5 stars");
    const profile = (await adminDb().collection("users").doc(user.uid).get()).data();
    const displayName = String(profile?.displayName ?? "").split(" ")[0] || "Customer";
    const review = await upsertReview({ uid: user.uid, displayName, ...parsed.data });
    revalidateCatalog();
    return Response.json({ review });
  } catch (err) {
    return errorResponse(err);
  }
}

const moderate = z.object({ productId: z.string().min(1), reviewUid: z.string().min(1), hidden: z.boolean() });

/** Admin: hide or show a review. */
export async function PATCH(req: Request) {
  try {
    await requireUser(req, ["admin"]);
    const parsed = moderate.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Invalid request");
    await setReviewHidden(parsed.data.productId, parsed.data.reviewUid, parsed.data.hidden);
    revalidateCatalog();
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
