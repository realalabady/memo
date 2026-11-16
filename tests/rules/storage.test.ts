import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { deleteObject, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/** Storage rules (review finding: anyone could upload; deletes always failed). */
let env: RulesTestEnvironment;
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "memo-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "merchants/m1"), { storeName: "S", slug: "s", status: "approved" });
    await setDoc(doc(ctx.firestore(), "merchants/m2"), { storeName: "P", slug: "p", status: "pending" });
  });
});

const store = (uid: string) => env.authenticatedContext(uid).storage();

describe("product images", () => {
  it("approved merchants upload into their own folder only", async () => {
    await assertSucceeds(uploadBytes(ref(store("m1"), "products/m1/a.png"), png, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(store("m1"), "products/m2/a.png"), png, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(store("m2"), "products/m2/a.png"), png, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(store("alice"), "products/alice/a.png"), png, { contentType: "image/png" }));
  });
  it("rejects SVG", async () => {
    await assertFails(uploadBytes(ref(store("m1"), "products/m1/a.svg"), png, { contentType: "image/svg+xml" }));
  });
  it("owners can delete their images", async () => {
    await uploadBytes(ref(store("m1"), "products/m1/b.png"), png, { contentType: "image/png" });
    await assertFails(deleteObject(ref(store("m2"), "products/m1/b.png")));
    await assertSucceeds(deleteObject(ref(store("m1"), "products/m1/b.png")));
  });
});
