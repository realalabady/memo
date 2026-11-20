import { z } from "zod";
import { errorResponse, HttpError } from "@/lib/server/auth";
import { requireApprovedMerchant, revalidateCatalog } from "@/lib/server/merchant";
import { listMerchantReviews, replyToReview } from "@/lib/server/reviews";

/** Reviews on the caller's products. */
export async function GET(req: Request) {
  try {
    const { user } = await requireApprovedMerchant(req);
    return Response.json({ reviews: await listMerchantReviews(user.uid) });
  } catch (err) {
    return errorResponse(err);
  }
}

const schema = z.object({
  productId: z.string().min(1),
  reviewUid: z.string().min(1),
  text: z.string().trim().max(1000),
});

/** Post (or clear, with empty text) the store's public reply to a review. */
export async function POST(req: Request) {
  try {
    const { user } = await requireApprovedMerchant(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Invalid reply");
    await replyToReview({ merchantId: user.uid, ...parsed.data });
    revalidateCatalog();
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
