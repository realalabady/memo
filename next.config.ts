import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run dev:emulator` uses its own folder so it can run beside `npm run dev`
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["firebase-admin"],
  experimental: {
    agentUpgrade: "security",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "*.firebasestorage.app" },
      // Storage emulator (development only)
      ...(process.env.NODE_ENV !== "production" ? [{ protocol: "http" as const, hostname: "127.0.0.1", port: "9199" }] : []),
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
