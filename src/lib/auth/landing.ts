import type { Role } from "@/lib/types";

export const home: Record<Role, string> = { admin: "/admin", merchant: "/merchant", customer: "/account" };

/**
 * Where to go after signing in. `next` is honoured only when it suits the role: an admin sent to
 * /account (or a shopper to /admin) by an old link lands on their own home instead.
 */
export function landing(role: Role, next: string | null) {
  if (!next) return home[role];
  const area = next.split(/[?#]/)[0].split("/")[1];
  if (area === "admin" && role !== "admin") return home[role];
  if (area === "merchant" && role === "customer") return home[role];
  if (area === "account" && role !== "customer") return home[role];
  return next;
}
