/**
 * Runs the app against the local Firebase emulators (project "demo-memo", fully offline).
 *   npm run emulators       → start Auth + Firestore + Storage emulators (keep it running)
 *   npm run emulator:seed   → create test accounts, categories and settings in the emulators
 *   npm run dev:emulator    → app on http://localhost:3005 talking to the emulators
 * The real project (.env.local) is never touched: these variables override it for this process only.
 */
import { spawn } from "node:child_process";

const env = {
  ...process.env,
  NEXT_DIST_DIR: ".next-emulator",
  NEXT_PUBLIC_APP_URL: "http://localhost:3005",
  NEXT_PUBLIC_FIREBASE_EMULATORS: "true",
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-memo.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-memo",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-memo.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "0",
  NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
  FIREBASE_PROJECT_ID: "demo-memo",
  GCLOUD_PROJECT: "demo-memo",
  FIREBASE_USE_ADC: "false",
  FIREBASE_CLIENT_EMAIL: "",
  FIREBASE_PRIVATE_KEY: "",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  ADMIN_EMAILS: "admin@memo.test",
  PAYMENTS_DEMO: "true",
  TABBY_SECRET_KEY: "",
  TAMARA_API_TOKEN: "",
};

const seed = process.argv.includes("--seed");
const [cmd, args] = seed ? ["npx", ["tsx", "scripts/seed-emulator.ts"]] : ["npx", ["next", "dev", "-p", "3005"]];
const child = spawn(cmd, args, { env, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
