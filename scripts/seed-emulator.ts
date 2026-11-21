/**
 * Test data for the local emulators only (run through `npm run emulator:seed`).
 * Refuses to run unless the emulator hosts are set, so it can never write to a real project.
 *
 * Test accounts (emulator only, not real credentials):
 *   admin@memo.test   / memo-test-1234  → admin (listed in ADMIN_EMAILS by dev-emulator.mjs)
 *   store@memo.test   / memo-test-1234  → will apply as a store
 *   shopper@memo.test / memo-test-1234  → customer
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { demoCategories } from "../src/lib/fixtures";
import { DEFAULT_SETTINGS } from "../src/lib/types";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to seed: emulator hosts are not set. Use `npm run emulator:seed`.");
  process.exit(1);
}

const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-memo" });
const auth = getAuth(app);
const db = getFirestore(app);

export const TEST_PASSWORD = "memo-test-1234";
const accounts = [
  { email: "admin@memo.test", displayName: "Test Admin" },
  { email: "store@memo.test", displayName: "Test Store Owner" },
  { email: "shopper@memo.test", displayName: "Test Shopper" },
];

async function main() {
  for (const a of accounts) {
    const existing = await auth.getUserByEmail(a.email).catch(() => null);
    if (existing) await auth.updateUser(existing.uid, { emailVerified: true, password: TEST_PASSWORD, disabled: false });
    else await auth.createUser({ ...a, password: TEST_PASSWORD, emailVerified: true });
  }
  const batch = db.batch();
  for (const { id, ...c } of demoCategories) batch.set(db.collection("categories").doc(id), { ...c, createdAt: Date.now() });
  // No hold period, so a delivered order is payable right away when testing payouts.
  batch.set(db.collection("settings").doc("platform"), { ...DEFAULT_SETTINGS, payoutHoldDays: 0, sellerName: "memo test", vatNumber: "300000000000003" });
  await batch.commit();
  console.log(`Emulator seeded: ${accounts.length} test accounts (password ${TEST_PASSWORD}), ${demoCategories.length} categories, settings.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
