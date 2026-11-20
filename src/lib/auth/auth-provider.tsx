"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase/client";
import { demoMerchants } from "@/lib/fixtures";
import type { Merchant, Role, UserProfile } from "@/lib/types";

interface AuthState {
  user: { uid: string; email: string; displayName: string } | null;
  profile: UserProfile | null;
  merchant: Merchant | null;
  loading: boolean;
  demo: boolean;
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** false only for a signed-in account whose email isn't confirmed yet (checkout requires it) */
  emailVerified: boolean;
  resendVerification: () => Promise<void>;
  /** Re-reads the account after the shopper clicked the email link. Resolves to the new state. */
  refreshVerification: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
  /** Demo mode only: enter as any role */
  enterDemo: (role: Role) => void;
}

const Ctx = createContext<AuthState | null>(null);
const DEMO_KEY = "memo-demo-role";

/** Creates/syncs users/{uid} and custom claims; refreshes the ID token when claims changed. */
async function bootstrap(user: User, displayName?: string) {
  const token = await user.getIdToken();
  const res = await fetch("/api/auth/bootstrap", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(displayName ? { displayName } : {}),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Sign-in failed");
  const body = (await res.json()) as { claimsChanged?: boolean };
  if (body.claimsChanged) await user.getIdToken(true);
}

/** Mints the httpOnly session cookie the server-gated dashboards check. */
async function mintSession(user: User) {
  const token = await user.getIdToken();
  await fetch("/api/auth/session", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
}

/** Only allow same-origin relative redirects (blocks `//evil.com` and absolute URLs). */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoRole, setDemoRole] = useState<Role | null>(null);
  const [verified, setVerified] = useState(true);

  // Demo mode: role lives in localStorage
  useEffect(() => {
    if (isFirebaseConfigured) return;
    let role: Role | null = null;
    try {
      role = (localStorage.getItem(DEMO_KEY) as Role | null) ?? null;
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage once
    setDemoRole(role);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth(), async (u) => {
      setFbUser(u);
      setVerified(u?.emailVerified ?? true);
      if (!u) {
        setProfile(null);
        setMerchant(null);
        setLoading(false);
      }
    });
  }, []);

  // Live profile + merchant docs. The profile is only exposed once the session cookie exists,
  // so redirects into server-gated dashboards never bounce back to /login.
  useEffect(() => {
    if (!isFirebaseConfigured || !fbUser) return;
    let first = true;
    const session = mintSession(fbUser).catch(console.error);
    const fail = (err: unknown) => {
      console.error(err);
      setProfile(null);
      setLoading(false);
    };
    const offProfile = onSnapshot(
      doc(db(), "users", fbUser.uid),
      async (snap) => {
        if (!snap.exists() && first) {
          first = false;
          // The snapshot fires again once bootstrap creates the doc.
          await bootstrap(fbUser).catch(fail);
          return;
        }
        await session;
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
        setLoading(false);
      },
      fail,
    );
    const offMerchant = onSnapshot(
      doc(db(), "merchants", fbUser.uid),
      (snap) => setMerchant(snap.exists() ? ({ id: snap.id, ...snap.data() } as Merchant) : null),
      console.error,
    );
    return () => {
      offProfile();
      offMerchant();
    };
  }, [fbUser]);

  const enterDemo = useCallback((role: Role) => {
    try {
      localStorage.setItem(DEMO_KEY, role);
    } catch {}
    setDemoRole(role);
  }, []);

  const value = useMemo<AuthState>(() => {
    if (!isFirebaseConfigured) {
      const demoUser = demoRole
        ? {
            uid: demoRole === "merchant" ? demoMerchants[0].id : demoRole === "admin" ? "admin" : "c0",
            email: `${demoRole}@memo.demo`,
            displayName: demoRole === "admin" ? "You (Admin)" : demoRole === "merchant" ? "Atelier Najd" : "Sara",
          }
        : null;
      return {
        user: demoUser,
        profile: demoUser ? { ...demoUser, role: demoRole!, createdAt: 0 } : null,
        merchant: demoRole === "merchant" ? demoMerchants[0] : null,
        loading,
        demo: true,
        getToken: async () => null,
        signIn: async () => {},
        signUp: async () => {},
        signInWithGoogle: async () => {},
        signOut: async () => {
          try {
            localStorage.removeItem(DEMO_KEY);
          } catch {}
          setDemoRole(null);
        },
        emailVerified: true,
        resendVerification: async () => {},
        refreshVerification: async () => true,
        resetPassword: async () => {},
        enterDemo,
      };
    }
    return {
      user: fbUser ? { uid: fbUser.uid, email: fbUser.email ?? "", displayName: fbUser.displayName ?? "" } : null,
      profile,
      merchant,
      loading,
      demo: false,
      getToken: async () => (fbUser ? fbUser.getIdToken() : null),
      signIn: async (email, password) => {
        const cred = await signInWithEmailAndPassword(auth(), email, password);
        await bootstrap(cred.user);
      },
      signUp: async (name, email, password) => {
        const cred = await createUserWithEmailAndPassword(auth(), email, password);
        await updateProfile(cred.user, { displayName: name });
        await sendEmailVerification(cred.user).catch(() => {});
        await bootstrap(cred.user, name);
      },
      signInWithGoogle: async () => {
        const cred = await signInWithPopup(auth(), new GoogleAuthProvider());
        await bootstrap(cred.user);
      },
      signOut: async () => {
        await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
        await fbSignOut(auth());
      },
      emailVerified: verified,
      resendVerification: async () => {
        if (fbUser) await sendEmailVerification(fbUser);
      },
      refreshVerification: async () => {
        if (!fbUser) return false;
        await fbUser.reload();
        if (fbUser.emailVerified) {
          await fbUser.getIdToken(true); // the token carries email_verified for the server
          await bootstrap(fbUser).catch(() => {}); // verified ADMIN_EMAILS get promoted here
        }
        setVerified(fbUser.emailVerified);
        return fbUser.emailVerified;
      },
      // Always resolves: never reveal whether an email has an account.
      resetPassword: async (email) => {
        await sendPasswordResetEmail(auth(), email).catch(() => {});
      },
      enterDemo,
    };
  }, [demoRole, fbUser, profile, merchant, loading, enterDemo, verified]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** fetch() with the Firebase ID token attached */
export function useAuthedFetch() {
  const { getToken } = useAuth();
  return useCallback(
    async (url: string, init: RequestInit = {}) => {
      const token = await getToken();
      return fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
    },
    [getToken],
  );
}
