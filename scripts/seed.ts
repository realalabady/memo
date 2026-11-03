/**
 * Seeds categories, sample stores and products into your Firebase project.
 *   npm run seed
 * Reads FIREBASE_* admin credentials from .env.local.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { demoCategories, demoMerchants, demoProducts } from "../src/lib/fixtures";
import { DEFAULT_SETTINGS } from "../src/lib/types";

process.loadEnvFile?.(".env.local");

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

async function main() {
  const batch = db.batch();
  for (const { id, ...c } of demoCategories) batch.set(db.collection("categories").doc(id), c);
  for (const { id, ...m } of demoMerchants) batch.set(db.collection("merchants").doc(id), m);
  for (const { id, ...p } of demoProducts) batch.set(db.collection("products").doc(id), p);
  batch.set(db.collection("settings").doc("platform"), DEFAULT_SETTINGS, { merge: true });
  await batch.commit();
  console.log(`Seeded ${demoCategories.length} categories, ${demoMerchants.length} stores, ${demoProducts.length} products.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
