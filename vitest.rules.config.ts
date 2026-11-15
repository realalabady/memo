import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config";

/** Firestore security-rules tests. Run via `npm run test:rules` (wraps the emulator). */
export default mergeConfig(
  base,
  defineConfig({
    test: { include: ["tests/rules/**/*.test.ts"], testTimeout: 20000, fileParallelism: false },
  }),
);
