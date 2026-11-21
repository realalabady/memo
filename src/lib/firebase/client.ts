"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Without Firebase keys the whole app runs in demo mode on sample data. */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

/** `npm run dev:emulator`: talk to the local Firebase emulators instead of the real project (never in production). */
const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true" && process.env.NODE_ENV !== "production";

let app: FirebaseApp | undefined;

function firebaseApp() {
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured");
  if (!app) {
    const existing = getApps().length > 0;
    app = existing ? getApp() : initializeApp(config);
    if (useEmulators && !existing) {
      connectAuthEmulator(getAuth(app), "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(getFirestore(app), "127.0.0.1", 8080);
      connectStorageEmulator(getStorage(app), "127.0.0.1", 9199);
    }
  }
  return app;
}

export const auth = (): Auth => getAuth(firebaseApp());
export const db = (): Firestore => getFirestore(firebaseApp());
export const storage = (): FirebaseStorage => getStorage(firebaseApp());
