import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * Run with `npm run test:rules` (starts the Firestore emulator).
 * Baseline coverage of today's rules; M1 adds the exploit cases from the review.
 */
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
    await setDoc(doc(db, "users/alice"), { uid: "alice", role: "customer" });
    await setDoc(doc(db, "users/admin"), { uid: "admin", role: "admin" });
    await setDoc(doc(db, "users/m1"), { uid: "m1", role: "merchant" });
    await setDoc(doc(db, "merchants/m1"), { storeName: "Store", slug: "store", status: "approved" });
    await setDoc(doc(db, "orders/o1"), { customerId: "alice", total: 100 });
    await setDoc(doc(db, "products/p1"), { merchantId: "m1", price: 100, stock: 5, status: "active" });
  });
});

describe("users", () => {
  it("cannot escalate their own role", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(updateDoc(doc(db, "users/alice"), { role: "admin" }));
    await assertSucceeds(updateDoc(doc(db, "users/alice"), { displayName: "Alice" }));
  });
});

describe("orders", () => {
  it("are readable by their customer only and never client-writable", async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext("alice").firestore(), "orders/o1")));
    await assertFails(getDoc(doc(env.authenticatedContext("bob").firestore(), "orders/o1")));
    await assertFails(setDoc(doc(env.authenticatedContext("alice").firestore(), "orders/o2"), { customerId: "alice" }));
  });
});

describe("settings", () => {
  it("only admins can write", async () => {
    await assertFails(setDoc(doc(env.authenticatedContext("alice").firestore(), "settings/platform"), { commissionRate: 0 }));
    await assertSucceeds(setDoc(doc(env.authenticatedContext("admin").firestore(), "settings/platform"), { commissionRate: 0.1 }));
  });
});

describe("products", () => {
  it("other merchants cannot edit a product", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "merchants/m2"), { storeName: "Other", slug: "other", status: "approved" }),
    );
    await assertFails(updateDoc(doc(env.authenticatedContext("m2").firestore(), "products/p1"), { price: 1 }));
  });
});
