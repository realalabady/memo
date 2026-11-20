import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Admin API route handlers against the Firestore emulator (run via `npm run test:rules`).
 * Only Firebase Auth is faked: the bearer token is the uid, and roles come from users/{uid}
 * exactly as in production, so role checks are exercised for real.
 */
const authCalls = vi.hoisted(() => ({ claims: [] as unknown[], disabled: [] as unknown[], revoked: [] as string[] }));

vi.mock("@/lib/firebase/admin", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/firebase/admin")>();
  const fakeAuth = {
    verifyIdToken: async (token: string) => ({ uid: token, email: `${token}@test.sa` }),
    getUser: async (uid: string) => {
      if (uid === "ghost") throw new Error("not found");
      return { uid, email: uid === "envadmin" ? "boss@memo.sa" : `${uid}@test.sa`, customClaims: {} };
    },
    setCustomUserClaims: async (uid: string, claims: unknown) => void authCalls.claims.push({ uid, claims }),
    revokeRefreshTokens: async (uid: string) => void authCalls.revoked.push(uid),
    updateUser: async (uid: string, patch: unknown) => void authCalls.disabled.push({ uid, patch }),
  };
  return { ...real, adminAuth: () => fakeAuth, adminBucket: () => null };
});
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const { adminDb } = await import("@/lib/firebase/admin");
const categories = await import("@/app/api/admin/categories/route");
const category = await import("@/app/api/admin/categories/[id]/route");
const reorder = await import("@/app/api/admin/categories/reorder/route");
const moderation = await import("@/app/api/admin/products/[id]/route");
const merchantProduct = await import("@/app/api/merchant/products/[id]/route");
const storefront = await import("@/app/api/admin/storefront/route");
const pages = await import("@/app/api/admin/pages/[slug]/route");
const users = await import("@/app/api/admin/users/[id]/route");
const stats = await import("@/app/api/admin/stats/route");
const exportCsv = await import("@/app/api/admin/transactions/export/route");
const { getLegalPage } = await import("@/lib/server/catalog");

const req = (uid: string | null, method = "GET", body?: unknown, url = "http://test/api") =>
  new Request(url, {
    method,
    headers: { ...(uid ? { Authorization: `Bearer ${uid}` } : {}), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) }) as never;
const json = async (res: Response) => ({ status: res.status, body: await res.json().catch(() => null) });
const doc = (path: string) => adminDb().doc(path);

async function wipe(...collections: string[]) {
  for (const c of collections) await adminDb().recursiveDelete(adminDb().collection(c));
}

beforeEach(async () => {
  await wipe("categories", "products", "settings", "pages", "merchantOrders", "payouts", "users", "merchants", "auditLogs");
  const db = adminDb();
  await db.doc("users/admin").set({ role: "admin" });
  await db.doc("users/m1").set({ role: "merchant" });
  await db.doc("users/alice").set({ role: "customer" });
  await db.doc("users/envadmin").set({ role: "admin" });
  await db.doc("merchants/m1").set({ storeName: "Store", slug: "store", status: "approved" });
  await db.doc("categories/home").set({ name: "Home", slug: "home", order: 1 });
  await db.doc("categories/beauty").set({ name: "Beauty", slug: "beauty", order: 2 });
  authCalls.claims = [];
  authCalls.disabled = [];
  authCalls.revoked = [];
  process.env.ADMIN_EMAILS = "boss@memo.sa";
});

describe("role gate on admin routes", () => {
  it("rejects anonymous callers and non-admins", async () => {
    expect((await categories.POST(req(null, "POST", { name: "X" }))).status).toBe(401);
    expect((await categories.POST(req("alice", "POST", { name: "X" }))).status).toBe(403);
    expect((await categories.POST(req("m1", "POST", { name: "X" }))).status).toBe(403);
    expect((await stats.GET(req("alice"))).status).toBe(403);
  });
});

describe("categories", () => {
  it("creates with a slug id and the next order, and refuses duplicates instead of overwriting", async () => {
    const res = await json(await categories.POST(req("admin", "POST", { name: "Home Office", nameAr: "المكتب" })));
    expect(res).toMatchObject({ status: 200, body: { id: "home-office" } });
    expect((await doc("categories/home-office").get()).data()).toMatchObject({ slug: "home-office", order: 3, nameAr: "المكتب" });

    const dup = await json(await categories.POST(req("admin", "POST", { name: "Home" })));
    expect(dup.status).toBe(409);
    expect((await doc("categories/home").get()).data()?.order).toBe(1); // untouched
  });

  it("gives Arabic-only names a usable slug", async () => {
    const res = await json(await categories.POST(req("admin", "POST", { name: "عطور", nameAr: "عطور" })));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("عطور");
  });

  it("edits names without changing the slug", async () => {
    await category.PATCH(req("admin", "PATCH", { name: "Home & Living", blurb: "Objects" }), ctx({ id: "home" }));
    expect((await doc("categories/home").get()).data()).toMatchObject({ name: "Home & Living", slug: "home", blurb: "Objects" });
    expect((await category.PATCH(req("admin", "PATCH", { name: "X" }), ctx({ id: "nope" }))).status).toBe(404);
  });

  it("blocks deleting a category that still has products, then moves them when asked", async () => {
    const db = adminDb();
    await db.doc("products/a").set({ merchantId: "m1", categoryId: "home", status: "active" });
    await db.doc("products/b").set({ merchantId: "m1", categoryId: "home", status: "draft" });
    await db.doc("products/c").set({ merchantId: "m1", categoryId: "home", status: "archived" });
    await db.doc("settings/storefront").set({ featuredCategoryIds: ["home", "beauty"] });

    const blocked = await json(await category.DELETE(req("admin", "DELETE", {}), ctx({ id: "home" })));
    expect(blocked).toMatchObject({ status: 409, body: { count: 2 } });
    expect((await doc("categories/home").get()).exists).toBe(true);

    expect((await category.DELETE(req("admin", "DELETE", { moveTo: "home" }), ctx({ id: "home" }))).status).toBe(400);
    const moved = await json(await category.DELETE(req("admin", "DELETE", { moveTo: "beauty" }), ctx({ id: "home" })));
    expect(moved).toMatchObject({ status: 200, body: { moved: 2 } });
    expect((await doc("categories/home").get()).exists).toBe(false);
    expect((await doc("products/a").get()).data()?.categoryId).toBe("beauty");
    expect((await doc("products/b").get()).data()?.categoryId).toBe("beauty");
    expect((await doc("products/c").get()).data()?.categoryId).toBe("home"); // archived rows keep history
    expect((await doc("settings/storefront").get()).data()?.featuredCategoryIds).toEqual(["beauty"]);
  });

  it("reorders, and rejects unknown ids", async () => {
    await reorder.POST(req("admin", "POST", { ids: ["beauty", "home"] }));
    expect((await doc("categories/beauty").get()).data()?.order).toBe(1);
    expect((await doc("categories/home").get()).data()?.order).toBe(2);
    expect((await reorder.POST(req("admin", "POST", { ids: ["beauty", "ghost"] }))).status).toBe(400);
  });
});

describe("product moderation", () => {
  const productBody = { title: "Lamp", price: 100, images: ["https://img.test/a.jpg"], categoryId: "home", stock: 3, status: "active" };

  beforeEach(async () => {
    await adminDb().doc("products/p").set({ ...productBody, merchantId: "m1", merchantName: "Store", merchantSlug: "store", createdAt: 1 });
  });

  it("needs a reason to hide", async () => {
    expect((await moderation.PATCH(req("admin", "PATCH", { hidden: true }), ctx({ id: "p" }))).status).toBe(400);
  });

  it("hides as a draft the store cannot republish, then restores the store's choice on release", async () => {
    expect((await moderation.PATCH(req("admin", "PATCH", { hidden: true, reason: "Counterfeit claim" }), ctx({ id: "p" }))).status).toBe(200);
    expect((await doc("products/p").get()).data()).toMatchObject({ status: "draft", hiddenByAdmin: true, hiddenReason: "Counterfeit claim", statusBeforeHide: "active" });

    // The store edits and asks for "active": it stays a draft, its wish is remembered
    const edit = await merchantProduct.PATCH(req("m1", "PATCH", { ...productBody, price: 120, status: "active" }), ctx({ id: "p" }));
    expect(edit.status).toBe(200);
    expect((await doc("products/p").get()).data()).toMatchObject({ status: "draft", price: 120, statusBeforeHide: "active", hiddenByAdmin: true });

    await moderation.PATCH(req("admin", "PATCH", { hidden: false }), ctx({ id: "p" }));
    const after = (await doc("products/p").get()).data()!;
    expect(after.status).toBe("active");
    expect(after.hiddenByAdmin).toBeUndefined();
    expect(after.statusBeforeHide).toBeUndefined();
  });

  it("refuses to moderate a product its store deleted", async () => {
    await adminDb().doc("products/p").update({ status: "archived" });
    expect((await moderation.PATCH(req("admin", "PATCH", { hidden: true, reason: "Spam listing" }), ctx({ id: "p" }))).status).toBe(409);
  });

  it("writes an audit entry", async () => {
    await moderation.PATCH(req("admin", "PATCH", { hidden: true, reason: "Spam listing" }), ctx({ id: "p" }));
    const logs = await adminDb().collection("auditLogs").where("action", "==", "admin.product.hide").get();
    expect(logs.size).toBe(1);
    expect(logs.docs[0].data()).toMatchObject({ actorUid: "admin", target: "products/p" });
  });
});

describe("storefront", () => {
  const valid = {
    hero: { l1: "Ramadan", l1Ar: "رمضان", l2: "", l2Ar: "", l3: "", l3Ar: "", body: "", bodyAr: "" },
    heroProductIds: ["p1"],
    featuredCategoryIds: ["home"],
    featuredProductIds: [],
    banner: { enabled: true, image: "https://img.test/b.jpg", link: "/shop?category=home", title: "Sale", titleAr: "تخفيضات", subtitle: "", subtitleAr: "" },
    sections: ["banner", "categories", "featured", "how", "stores", "sell"].map((id) => ({ id, visible: true })),
  };

  it("saves a valid storefront", async () => {
    expect((await storefront.PUT(req("admin", "PUT", valid))).status).toBe(200);
    const saved = (await doc("settings/storefront").get()).data()!;
    expect(saved.hero.l1Ar).toBe("رمضان");
    expect(saved.sections[0]).toEqual({ id: "banner", visible: true });
  });

  it("rejects unsafe links, banners without an image, and repeated sections", async () => {
    for (const link of ["javascript:alert(1)", "//evil.test", "http://insecure.test"]) {
      expect((await storefront.PUT(req("admin", "PUT", { ...valid, banner: { ...valid.banner, link } }))).status).toBe(400);
    }
    expect((await storefront.PUT(req("admin", "PUT", { ...valid, banner: { ...valid.banner, image: "" } }))).status).toBe(400);
    const dupSections = [...valid.sections.slice(0, 5), { id: "banner", visible: false }];
    expect((await storefront.PUT(req("admin", "PUT", { ...valid, sections: dupSections }))).status).toBe(400);
    expect((await storefront.PUT(req("admin", "PUT", { ...valid, heroProductIds: ["a", "b", "c", "d"] }))).status).toBe(400);
  });
});

describe("legal pages", () => {
  const page = { title: "Returns", titleAr: "الإرجاع", body: "## Window\n- 14 days", bodyAr: "## المدة\n- 14 يومًا" };

  it("publishes an edited page and restores the built-in text", async () => {
    expect((await pages.PUT(req("admin", "PUT", page), ctx({ slug: "returns" }))).status).toBe(200);
    expect(await getLegalPage("returns")).toMatchObject({ title: "Returns", bodyAr: "## المدة\n- 14 يومًا" });
    expect((await getLegalPage("returns")).updatedAt).toBeGreaterThan(0);

    expect((await pages.DELETE(req("admin", "DELETE"), ctx({ slug: "returns" }))).status).toBe(200);
    expect(await getLegalPage("returns")).toMatchObject({ title: "Returns & refunds", updatedAt: 0 });
  });

  it("refuses unknown pages, empty text and non-admins", async () => {
    expect((await pages.PUT(req("admin", "PUT", page), ctx({ slug: "about" }))).status).toBe(404);
    expect((await pages.PUT(req("admin", "PUT", { ...page, bodyAr: " " }), ctx({ slug: "terms" }))).status).toBe(400);
    expect((await pages.PUT(req("m1", "PUT", page), ctx({ slug: "terms" }))).status).toBe(403);
  });
});

describe("users", () => {
  it("grants admin and keeps a store owner's merchant role when it is removed", async () => {
    await users.PATCH(req("admin", "PATCH", { admin: true }), ctx({ id: "m1" }));
    expect((await doc("users/m1").get()).data()?.role).toBe("admin");
    expect(authCalls.claims.at(-1)).toMatchObject({ uid: "m1", claims: { role: "admin", merchantStatus: "approved" } });
    expect(authCalls.revoked).toContain("m1");

    await users.PATCH(req("admin", "PATCH", { admin: false }), ctx({ id: "m1" }));
    expect((await doc("users/m1").get()).data()?.role).toBe("merchant");
  });

  it("protects ADMIN_EMAILS admins and the caller's own account", async () => {
    expect((await users.PATCH(req("admin", "PATCH", { admin: false }), ctx({ id: "envadmin" }))).status).toBe(409);
    expect((await users.PATCH(req("admin", "PATCH", { disabled: true }), ctx({ id: "admin" }))).status).toBe(400);
    expect((await users.PATCH(req("admin", "PATCH", { disabled: true }), ctx({ id: "ghost" }))).status).toBe(404);
  });

  it("disables and re-enables an account", async () => {
    await users.PATCH(req("admin", "PATCH", { disabled: true }), ctx({ id: "alice" }));
    expect(authCalls.disabled.at(-1)).toEqual({ uid: "alice", patch: { disabled: true } });
    expect(authCalls.revoked).toContain("alice");
    expect((await doc("users/alice").get()).data()?.disabled).toBe(true);
    await users.PATCH(req("admin", "PATCH", { disabled: false }), ctx({ id: "alice" }));
    expect((await doc("users/alice").get()).data()?.disabled).toBe(false);
  });
});

describe("stats and CSV export", () => {
  beforeEach(async () => {
    const db = adminDb();
    const row = (id: string, data: Record<string, unknown>) =>
      db.doc(`merchantOrders/${id}`).set({
        orderId: id,
        merchantId: "m1",
        merchantName: "Store",
        customer: { firstName: "Sara", lastName: "A", email: "s@a.sa", phone: "05", city: "Riyadh", line1: "x" },
        items: [{ title: "Lamp", quantity: 1 }],
        commission: 10,
        providerFee: 5,
        createdAt: Date.now(),
        ...data,
      });
    await row("o1", { provider: "tabby", paymentStatus: "captured", payoutStatus: "unpaid", subtotal: 100, payoutAmount: 85 });
    await row("o2", { provider: "tamara", paymentStatus: "captured", payoutStatus: "paid", subtotal: 200, payoutAmount: 170 });
    await row("o3", { provider: "tamara", paymentStatus: "captured", payoutStatus: "on_hold", subtotal: 50, payoutAmount: 40 });
    await row("o4", { provider: "tabby", paymentStatus: "failed", payoutStatus: "unpaid", subtotal: 999, payoutAmount: 900 });
    await db.doc("payouts/x").set({ merchantId: "m1", amount: 170 });
  });

  it("totals only paid rows, over the whole ledger", async () => {
    const { body } = await json(await stats.GET(req("admin")));
    expect(body).toMatchObject({ paidCount: 3, collected: 350, commission: 30, providerFees: 15, tabby: 100, tamara: 250, owed: 125, transferred: 170, payoutCount: 1 });
    expect(body.balances).toEqual([{ id: "m1", name: "Store", amount: 125, count: 2 }]);
  });

  it("exports every matching row as CSV", async () => {
    const all = await (await exportCsv.GET(req("admin", "GET", undefined, "http://test/api?provider=all"))).text();
    expect(all.split("\n").filter(Boolean)).toHaveLength(5); // header + 4 rows
    const tamaraPaid = await (await exportCsv.GET(req("admin", "GET", undefined, "http://test/api?provider=tamara&payout=paid"))).text();
    expect(tamaraPaid).toContain('"o2"');
    expect(tamaraPaid).not.toContain('"o1"');
    expect((await exportCsv.GET(req("alice"))).status).toBe(403);
  });
});
