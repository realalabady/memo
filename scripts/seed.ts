/**
 * Seeds a Firebase project.
 *   npm run seed              → categories + platform settings (safe for production)
 *   npm run seed -- --samples → also the sample stores and products (for a staging/demo project)
 * Reads FIREBASE_* admin credentials from .env.local. Never overwrites existing settings.
 * Sample stores have no owner account; sign-ins for real stores come from /sell applications.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { demoCategories, demoMerchants, demoProducts } from "../src/lib/fixtures";
import { DEFAULT_SETTINGS } from "../src/lib/types";

process.loadEnvFile?.(".env.local");

const samples = process.argv.includes("--samples");

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
  for (const { id, ...c } of demoCategories) batch.set(db.collection("categories").doc(id), { ...c, createdAt: Date.now() }, { merge: true });

  const settings = db.collection("settings").doc("platform");
  if (!(await settings.get()).exists) batch.set(settings, DEFAULT_SETTINGS);

  if (samples) {
    for (const { id, ...m } of demoMerchants) {
      batch.set(db.collection("merchants").doc(id), m);
      batch.set(db.collection("slugs").doc(m.slug), { merchantId: id });
    }
    for (const { id, ...p } of demoProducts) batch.set(db.collection("products").doc(id), JSON.parse(JSON.stringify(p)));
  }
  await batch.commit();
  console.log(
    `Seeded ${demoCategories.length} categories and platform settings` +
      (samples ? `, ${demoMerchants.length} sample stores and ${demoProducts.length} products.` : ". Add --samples for sample stores and products."),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
