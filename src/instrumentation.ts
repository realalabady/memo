/**
 * Runs once when the server starts. Fails fast on configurations that would
 * silently run a half-demo marketplace or expose the payment simulator.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const client = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const admin = Boolean(
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY,
  );
  const problems: string[] = [];

  // Mixed config = storefront on sample data while dashboards write to real Firestore.
  if (client !== admin) {
    problems.push(
      "Firebase is half-configured: set BOTH the NEXT_PUBLIC_FIREBASE_* web keys and the FIREBASE_* admin keys (or neither, for demo mode).",
    );
  }

  if (process.env.NODE_ENV === "production") {
    if (!client || !admin) problems.push("Production requires Firebase keys — demo mode is development-only.");
    if (process.env.PAYMENTS_DEMO === "true") problems.push("PAYMENTS_DEMO=true is not allowed in production.");
    if (!process.env.NEXT_PUBLIC_APP_URL) problems.push("NEXT_PUBLIC_APP_URL is required in production.");
  }

  if (problems.length) {
    const message = `[memo] Invalid configuration:\n- ${problems.join("\n- ")}`;
    if (process.env.NODE_ENV === "production") throw new Error(message);
    console.warn(message);
  }
}
