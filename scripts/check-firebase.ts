/**
 * Read-only connection check for the server credentials (key file or ADC).
 *   npx tsx scripts/check-firebase.ts
 */
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

process.loadEnvFile?.(".env.local");

const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const app = initializeApp({
  projectId,
  credential: privateKey ? cert({ projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey }) : applicationDefault(),
});

async function main() {
  console.log(`Project: ${projectId} · credentials: ${privateKey ? "service-account key" : "Application Default Credentials"}`);
  const cols = await getFirestore(app).listCollections();
  console.log(`Firestore OK · ${cols.length} collections${cols.length ? `: ${cols.map((c) => c.id).join(", ")}` : ""}`);
  const users = await getAuth(app).listUsers(1);
  console.log(`Auth OK · listed ${users.users.length} user(s)`);
}

main().catch((e) => {
  console.error("Check failed:", e.message ?? e);
  process.exit(1);
});
