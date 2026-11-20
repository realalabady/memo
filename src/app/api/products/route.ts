import { getProducts } from "@/lib/server/catalog";

/**
 * Public lookup of active products by id: GET /api/products?ids=a,b,c
 * Used by the wishlist page and to re-check prices/stock in the bag.
 * Reads the cached catalog, so only products of approved stores are returned.
 */
export async function GET(req: Request) {
  const ids = new Set(
    (new URL(req.url).searchParams.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 60),
  );
  if (!ids.size) return Response.json({ products: [] });
  const products = (await getProducts()).filter((p) => ids.has(p.id));
  return Response.json({ products });
}
