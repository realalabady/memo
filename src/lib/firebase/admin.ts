import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
/** Set automatically by `firebase emulators:exec` (integration tests). Never set in production. */
const emulator = process.env.NODE_ENV !== "production" && Boolean(process.env.FIRESTORE_EMULATOR_HOST);

export const isAdminConfigured = Boolean(projectId && clientEmail && privateKey) || emulator;

let app: App | undefined;

function adminApp() {
  if (!isAdminConfigured) throw new Error("Firebase Admin is not configured");
  app ??=
    getApps()[0] ??
    (emulator && !privateKey
      ? initializeApp({ projectId: projectId ?? process.env.GCLOUD_PROJECT ?? "memo-rules-test" })
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }));
  return app;
}

export const adminDb = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());
