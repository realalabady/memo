import { describe, expect, it } from "vitest";
import { normalize, PAGE_SIZE, parseShopQuery, searchProducts, shopQueryString } from "./search";
import type { Product } from "./types";

const product = (over: Partial<Product>): Product => ({
  id: "x",
  merchantId: "m1",
  merchantName: "Dar Al Oud",
  merchantSlug: "dar-al-oud",
  title: "Oud Noir Extrait",
  description: "Smoked leather and saffron",
  price: 100,
  images: [],
  categoryId: "beauty",
  stock: 5,
  status: "active",
  createdAt: 1,
  ...over,
});

const catalog: Product[] = [
  product({ id: "a", title: "Oud Noir Extrait", titleAr: "عطر عود نوار المركّز", price: 890, createdAt: 3, ratingAvg: 4.5, ratingCount: 2 }),
  product({ id: "b", title: "Field Sneaker", titleAr: "حذاء فيلد", merchantId: "m2", merchantName: "Atelier Najd", categoryId: "fashion", price: 529, createdAt: 2, stock: 0 }),
  product({ id: "c", title: "Café Crème Mug", merchantId: "m2", merchantName: "Atelier Najd", categoryId: "home", price: 60, createdAt: 1, ratingAvg: 5, ratingCount: 1 }),
];
const q = (params: Record<string, string>) => parseShopQuery(params);
const ids = (params: Record<string, string>) => searchProducts(catalog, q(params)).items.map((p) => p.id);

describe("normalize", () => {
  it("ignores case, accents and Arabic diacritics / letter variants", () => {
    expect(normalize("Café CRÈME")).toBe("cafe creme");
    expect(normalize("المركّز")).toBe(normalize("المركز"));
    expect(normalize("أحذية")).toBe(normalize("احذيه"));
  });
});

describe("searchProducts", () => {
  it("matches every word across title, Arabic title, store and description", () => {
    expect(ids({ q: "oud noir" })).toEqual(["a"]);
    expect(ids({ q: "عود" })).toEqual(["a"]);
    expect(ids({ q: "atelier" })).toEqual(["b", "c"]);
    expect(ids({ q: "creme mug" })).toEqual(["c"]);
    expect(ids({ q: "oud sneaker" })).toEqual([]);
    expect(ids({ q: "tel" })).toEqual([]); // "tel" is inside "Atelier" but starts no word
    expect(ids({ q: "مركز" })).toEqual(["a"]); // matches "المركّز" without the article
  });
  it("filters by category, store, price range and stock", () => {
    expect(ids({ category: "fashion" })).toEqual(["b"]);
    expect(ids({ store: "m2", stock: "1" })).toEqual(["c"]);
    expect(ids({ min: "100", max: "600" })).toEqual(["b"]);
  });
  it("sorts by newest, price and rating", () => {
    expect(ids({})).toEqual(["a", "b", "c"]);
    expect(ids({ sort: "price_asc" })).toEqual(["c", "b", "a"]);
    expect(ids({ sort: "price_desc" })).toEqual(["a", "b", "c"]);
    expect(ids({ sort: "rating" })).toEqual(["c", "a", "b"]);
  });
  it("pages results and clamps an out-of-range page", () => {
    const many = Array.from({ length: PAGE_SIZE + 3 }, (_, i) => product({ id: `p${i}`, createdAt: i }));
    const r = searchProducts(many, q({ page: "99" }));
    expect(r.pages).toBe(2);
    expect(r.page).toBe(2);
    expect(r.items).toHaveLength(3);
  });
});

describe("shop query strings", () => {
  it("ignores junk input and round-trips real filters", () => {
    expect(q({ sort: "drop table", page: "-4", min: "abc" })).toMatchObject({ sort: "new", page: 1, min: null });
    const query = q({ q: "oud", category: "beauty", min: "50", stock: "1", sort: "price_asc", page: "3" });
    expect(shopQueryString(query)).toBe("?q=oud&category=beauty&min=50&stock=1&sort=price_asc&page=3");
    expect(shopQueryString(query, { page: 1 })).toBe("?q=oud&category=beauty&min=50&stock=1&sort=price_asc");
    expect(shopQueryString(q({}))).toBe("");
  });
});
