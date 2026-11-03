"use client";

import { isFirebaseConfigured } from "@/lib/firebase/client";

export function DemoBanner() {
  if (isFirebaseConfigured) return null;
  return (
    <div className="fixed bottom-4 left-4 z-30 hidden max-w-xs rounded-2xl bg-ink/90 px-4 py-3 text-[12px] leading-relaxed text-paper/80 shadow-[var(--shadow-float)] backdrop-blur md:block">
      <span className="font-medium text-paper">Demo mode.</span> Sample data only — add your Firebase keys to{" "}
      <code className="text-ember">.env.local</code> to go live.
    </div>
  );
}
