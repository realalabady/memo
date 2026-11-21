import "server-only";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
/** Set automatically by `firebase emulators:exec` (integration tests). Never set in production. */
const emulator = process.env.NODE_ENV !== "production" && Boolean(process.env.FIRESTORE_EMULATOR_HOST);

/**
 * No key file? Set FIREBASE_USE_ADC=true to use Application Default Credentials instead:
 * locally your own Google login (`gcloud auth application-default login`), on Google Cloud
 * (Cloud Run, Firebase App Hosting) the runtime's service account. Needed when the organization
 * blocks service-account keys (iam.disableServiceAccountKeyCreation).
 */
const useAdc = process.env.FIREBASE_USE_ADC === "true" && Boolean(projectId);

export const isAdminConfigured = Boolean(projectId && clientEmail && privateKey) || useAdc || emulator;

let app: App | undefined;

function adminApp() {
  if (!isAdminConfigured) throw new Error("Firebase Admin is not configured");
  app ??=
    getApps()[0] ??
    (emulator && !privateKey
      ? initializeApp({ projectId: projectId ?? process.env.GCLOUD_PROJECT ?? "memo-rules-test" })
      : privateKey
        ? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
        : initializeApp({ credential: applicationDefault(), projectId }));
  return app;
}

export const adminDb = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());

/** The project's Storage bucket (same one the web SDK uploads to), or null when it isn't configured. */
export const adminBucket = () => {
  const name = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return name ? getStorage(adminApp()).bucket(name) : null;
};
