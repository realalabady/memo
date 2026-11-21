"use client";

import type { User } from "firebase/auth";

/**
 * The ID token for API calls. Firebase caches a token for up to an hour, so one minted before the
 * user clicked the verification link still says `email_verified: false` and the server refuses
 * checkout / store applications. When the account is verified but the cached token isn't, mint a new one.
 */
export async function freshIdToken(user: User) {
  const result = await user.getIdTokenResult();
  if (user.emailVerified && result.claims.email_verified !== true) return user.getIdToken(true);
  return result.token;
}
