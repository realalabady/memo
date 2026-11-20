import { describe, expect, it } from "vitest";

/** Rate limiter against the Firestore emulator (run via `npm run test:rules`). */
const { rateLimit } = await import("@/lib/server/rate-limit");

describe("rateLimit", () => {
  it("allows up to the limit in a window, then refuses with 429", async () => {
    const key = `u${Date.now()}`;
    for (let i = 0; i < 3; i++) await rateLimit("test", key, 3, 600);
    await expect(rateLimit("test", key, 3, 600)).rejects.toMatchObject({ status: 429 });
  });

  it("counts each user and bucket separately", async () => {
    const key = `v${Date.now()}`;
    await rateLimit("a", key, 1, 600);
    await expect(rateLimit("b", key, 1, 600)).resolves.toBeUndefined();
    await expect(rateLimit("a", `${key}-other`, 1, 600)).resolves.toBeUndefined();
  });

  it("holds under concurrent requests", async () => {
    const key = `w${Date.now()}`;
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => rateLimit("burst", key, 4, 600)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(4);
  });
});
