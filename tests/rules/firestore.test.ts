import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/** Run with `npm run test:rules` (starts the Firestore emulator). */
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "memo-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice"), { uid: "alice", role: "customer", displayName: "A" });
    await setDoc(doc(db, "users/admin"), { uid: "admin", role: "admin" });
    await setDoc(doc(db, "users/m1"), { uid: "m1", role: "merchant" });
    await setDoc(doc(db, "merchants/m1"), { storeName: "Store", slug: "store", status: "approved" });
    await setDoc(doc(db, "merchants/m1/private/bank"), { iban: "SA0000000000000000000000" });
    await setDoc(doc(db, "orders/o1"), { customerId: "alice", total: 100 });
    await setDoc(doc(db, "products/p1"), { merchantId: "m1", price: 100, stock: 5, status: "active" });
    await setDoc(doc(db, "products/d1"), { merchantId: "m1", price: 100, stock: 5, status: "draft" });
    await setDoc(doc(db, "ledgerAdjustments/a1"), { merchantId: "m1", amount: -50, status: "open" });
    await setDoc(doc(db, "merchantOrders/o1_m1"), {
      merchantId: "m1",
      customerId: "alice",
      paymentStatus: "pending",
      fulfillmentStatus: "pending",
    });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe("users", () => {
  it("cannot escalate their own role or touch other fields", async () => {
    await assertFails(updateDoc(doc(as("alice"), "users/alice"), { role: "admin" }));
    await assertFails(updateDoc(doc(as("alice"), "users/alice"), { email: "x@y.z" }));
    await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), { displayName: "Alice" }));
  });
  it("cannot create or read other profiles", async () => {
    await assertFails(setDoc(doc(as("bob"), "users/bob"), { uid: "bob", role: "admin" }));
    await assertFails(getDoc(doc(as("bob"), "users/alice")));
  });
});

describe("products (review finding: negative-price exploit)", () => {
  it("merchants cannot write products from the client at all", async () => {
    await assertFails(updateDoc(doc(as("m1"), "products/p1"), { price: -900 }));
    await assertFails(updateDoc(doc(as("m1"), "products/p1"), { merchantName: "Someone else" }));
    await assertFails(addDoc(collection(as("m1"), "products"), { merchantId: "m1", price: 10, stock: 1, status: "active" }));
    await assertFails(deleteDoc(doc(as("m1"), "products/p1")));
  });
  it("public sees active products only; owner sees drafts", async () => {
    await assertSucceeds(getDoc(doc(anon(), "products/p1")));
    await assertFails(getDoc(doc(anon(), "products/d1")));
    await assertSucceeds(getDoc(doc(as("m1"), "products/d1")));
  });
});

describe("merchants", () => {
  it("cannot self-approve, change commission, or create a store from the client", async () => {
    await assertFails(updateDoc(doc(as("m1"), "merchants/m1"), { status: "approved" }));
    await assertFails(updateDoc(doc(as("m1"), "merchants/m1"), { commissionRate: 0 }));
    await assertFails(setDoc(doc(as("alice"), "merchants/alice"), { storeName: "X", status: "pending" }));
  });
  it("bank details: readable by owner/admin, never client-writable", async () => {
    await assertSucceeds(getDoc(doc(as("m1"), "merchants/m1/private/bank")));
    await assertSucceeds(getDoc(doc(as("admin"), "merchants/m1/private/bank")));
    await assertFails(getDoc(doc(as("alice"), "merchants/m1/private/bank")));
    await assertFails(setDoc(doc(as("m1"), "merchants/m1/private/bank"), { iban: "SA1" }));
  });
});

describe("merchantOrders (review finding: fulfilling unpaid orders)", () => {
  it("cannot be updated from the client, even by the owning merchant", async () => {
    await assertFails(updateDoc(doc(as("m1"), "merchantOrders/o1_m1"), { fulfillmentStatus: "shipped" }));
  });
  it("are readable by the store only: customers never see commission or payout figures", async () => {
    await assertSucceeds(getDoc(doc(as("m1"), "merchantOrders/o1_m1")));
    await assertFails(getDoc(doc(as("alice"), "merchantOrders/o1_m1")));
    await assertFails(getDoc(doc(as("bob"), "merchantOrders/o1_m1")));
  });
});

describe("orders", () => {
  it("are readable by their customer only and never client-writable", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "orders/o1")));
    await assertFails(getDoc(doc(as("bob"), "orders/o1")));
    await assertFails(setDoc(doc(as("alice"), "orders/o2"), { customerId: "alice" }));
    await assertFails(updateDoc(doc(as("alice"), "orders/o1"), { total: 1 }));
  });
});

describe("settings, categories, audit", () => {
  it("settings are server-only, even for admins", async () => {
    await assertFails(setDoc(doc(as("admin"), "settings/platform"), { commissionRate: 0 }));
    await assertSucceeds(getDoc(doc(anon(), "settings/platform")));
  });
  it("categories and the storefront are server-written, even for admins", async () => {
    const cat = { name: "Home", slug: "home", order: 1 };
    await assertFails(setDoc(doc(as("alice"), "categories/home"), cat));
    await assertFails(setDoc(doc(as("admin"), "categories/home"), cat));
    await assertFails(setDoc(doc(as("admin"), "settings/storefront"), { sections: [] }));
    await assertSucceeds(getDoc(doc(anon(), "categories/home")));
    await assertSucceeds(getDoc(doc(anon(), "settings/storefront")));
  });
  it("admins can list users and audit logs; customers cannot", async () => {
    await assertSucceeds(getDocs(collection(as("admin"), "users")));
    await assertSucceeds(getDocs(collection(as("admin"), "auditLogs")));
    await assertFails(getDocs(collection(as("alice"), "users")));
    await assertFails(getDocs(collection(as("alice"), "auditLogs")));
  });
  it("legal pages are public to read, server-written; rate limits are private", async () => {
    await assertSucceeds(getDoc(doc(anon(), "pages/returns")));
    await assertFails(setDoc(doc(as("admin"), "pages/returns"), { title: "x" }));
    await assertFails(getDoc(doc(as("alice"), "rateLimits/checkout_alice")));
    await assertFails(setDoc(doc(as("alice"), "rateLimits/checkout_alice"), { count: 0 }));
  });
  it("payment keys are closed to every client, admins included", async () => {
    await assertFails(getDoc(doc(as("admin"), "secrets/payments")));
    await assertFails(setDoc(doc(as("admin"), "secrets/payments"), { tabby: { secretKey: "sk_x" } }));
    await assertFails(getDoc(doc(anon(), "secrets/payments")));
  });
  it("admins can list every product, including drafts", async () => {
    await assertSucceeds(getDocs(collection(as("admin"), "products")));
    await assertFails(getDocs(collection(anon(), "products")));
  });
  it("audit logs are admin-read, never client-written", async () => {
    await assertFails(addDoc(collection(as("admin"), "auditLogs"), { action: "x" }));
  });
});

describe("ledgerAdjustments (refund clawbacks)", () => {
  it("are readable by the store and admin only, never client-written", async () => {
    await assertSucceeds(getDoc(doc(as("m1"), "ledgerAdjustments/a1")));
    await assertSucceeds(getDoc(doc(as("admin"), "ledgerAdjustments/a1")));
    await assertFails(getDoc(doc(as("alice"), "ledgerAdjustments/a1")));
    await assertFails(updateDoc(doc(as("m1"), "ledgerAdjustments/a1"), { status: "applied" }));
    await assertFails(deleteDoc(doc(as("m1"), "ledgerAdjustments/a1")));
  });
});
describe("wishlist and addresses (owner only)", () => {
  const address = { firstName: "A", lastName: "B", email: "a@b.sa", phone: "0551234567", city: "Riyadh", line1: "Street 1", createdAt: 1 };
  it("shoppers manage their own wishlist; ids must match the product", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "users/alice/wishlist/p1"), { productId: "p1", createdAt: 1 }));
    await assertFails(setDoc(doc(as("alice"), "users/alice/wishlist/p1"), { productId: "other", createdAt: 1 }));
    await assertFails(setDoc(doc(as("bob"), "users/alice/wishlist/p1"), { productId: "p1", createdAt: 1 }));
    await assertFails(getDoc(doc(as("bob"), "users/alice/wishlist/p1")));
    await assertSucceeds(deleteDoc(doc(as("alice"), "users/alice/wishlist/p1")));
  });
  it("shoppers manage their own addresses with known fields only", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "users/alice/addresses/a1"), address));
    await assertSucceeds(setDoc(doc(as("alice"), "users/alice/addresses/a4"), { ...address, nationalAddress: "RRRD2929" }));
    await assertFails(setDoc(doc(as("alice"), "users/alice/addresses/a5"), { ...address, nationalAddress: "rrrd29" }));
    await assertFails(setDoc(doc(as("alice"), "users/alice/addresses/a2"), { ...address, role: "admin" }));
    await assertFails(setDoc(doc(as("bob"), "users/alice/addresses/a3"), address));
    await assertFails(getDoc(doc(as("bob"), "users/alice/addresses/a1")));
  });
});

describe("reviews", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "products/p1/reviews/alice"), { uid: "alice", rating: 5, text: "Great", createdAt: 1 });
      await setDoc(doc(ctx.firestore(), "products/p1/reviews/bob"), { uid: "bob", rating: 1, text: "spam", hidden: true, createdAt: 2 });
    });
  });
  it("are public unless hidden, and never client-written", async () => {
    await assertSucceeds(getDoc(doc(anon(), "products/p1/reviews/alice")));
    await assertFails(getDoc(doc(anon(), "products/p1/reviews/bob")));
    await assertSucceeds(getDoc(doc(as("bob"), "products/p1/reviews/bob")));
    await assertSucceeds(getDoc(doc(as("admin"), "products/p1/reviews/bob")));
    await assertFails(setDoc(doc(as("alice"), "products/p1/reviews/alice"), { uid: "alice", rating: 5, text: "x", createdAt: 1 }));
    await assertFails(updateDoc(doc(as("m1"), "products/p1/reviews/alice"), { rating: 5 }));
  });
});