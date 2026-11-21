@AGENTS.md

# memo — project instructions

Multi-store marketplace for Saudi Arabia: independent stores sell, shoppers pay in 4 with Tabby or Tamara through the **platform's** provider accounts, and the admin pays merchants from a per-order ledger.

## Stack
- Next.js 16 App Router (`cacheComponents: true`), React 19, TypeScript, Tailwind CSS 4
- Firebase: Auth (client SDK), Firestore + Storage, firebase-admin on the server
- zod for API input, zustand for the cart (`memo-cart` in localStorage), motion for animation, sonner toasts
- **This Next.js has breaking changes** — read `node_modules/next/dist/docs/` before using routing/caching APIs (`proxy.ts` not middleware, `"use cache"` + `cacheTag`, async `params`).

## Commands
- Dev: `npm run dev` (port 3000) · Build: `npm run build` · Lint: `npm run lint` · Types: `npm run typecheck`
- Unit tests: `npm test` (Vitest, `src/**/*.test.ts`)
- Rules + integration tests: `npm run test:rules` (Firestore/Storage emulators via firebase-tools; needs Java). Route handlers are tested in `tests/rules/*.int.test.ts`
- Seed sample data: `npm run seed`
- End-to-end against emulators: `npm run emulators`, `npm run emulator:seed`, `npm run dev:emulator` (port 3005, own `.next-emulator` dir, test accounts in `scripts/seed-emulator.ts`)
- Server credentials without a key file: `FIREBASE_USE_ADC=true` (+ `GOOGLE_CLOUD_QUOTA_PROJECT` locally); check with `npm run check:firebase`

## Where things live
- `src/app/(store)/` storefront · `src/app/merchant/`, `src/app/admin/` dashboards (server-gated by `components/dashboard/role-gate.tsx`)
- `src/app/api/` route handlers — checkout, payments return URLs, webhooks, admin payouts, auth bootstrap/session
- `src/lib/server/` server-only logic: `orders.ts` (order creation, settlement), `catalog.ts` (cached storefront reads), `auth.ts` (`requireUser`, sessions), `roles.ts` (custom claims)
- `src/lib/payments/` Tabby/Tamara clients · `src/lib/money.ts` split math in halalas
- `src/lib/data/` client hooks (live Firestore) and mutations · `src/lib/fixtures.ts` demo data
- `firestore.rules`, `storage.rules`, `firestore.indexes.json` — security boundary; test in `tests/rules/`

## Rules that matter
- **Money and roles are server-only.** Orders, payment status, payouts, prices used for charging, commission, and roles are written with the Admin SDK in route handlers — never from the client SDK. Never trust prices, totals or roles sent by the browser.
- Every API route: validate with zod, authenticate with `requireUser(req, roles?)`, throw `HttpError`, return `errorResponse(err)`.
- Change roles only via `setRoleClaims` (`src/lib/server/roles.ts`); admins must never be demoted by store status changes.
- Money math in halalas (`money.ts`), amounts sent to providers as 2-decimal values, currency SAR.
- Settlement must stay idempotent: return URL and webhook can both fire for the same payment.
- Prices are VAT-inclusive; `computeSplit`/`vatIncluded` (`money.ts`) record the VAT, they never add it on top.
- Refunds go through `refundOrder` (`src/lib/server/refunds.ts`): claim → provider → record. `refunded` is a final state. A refund on an already-paid-out row creates a `ledgerAdjustments` clawback netted into the next payout.
- A ledger row is payable only when `payoutEligibility` says so (paid, delivered, past `settings.payoutHoldDays`, not on hold).
- Webhooks are de-duplicated and logged via `handleOnce` (`paymentEvents`); the body is a hint, always re-read the payment from the provider.
- Shop search/filter/sort/paging is in-memory over the cached catalog (`src/lib/search.ts`); state lives in the URL.
- Reviews are written only by `src/lib/server/reviews.ts` (verified buyers; product keeps `ratingSum/Count/Avg`). Customers never read `merchantOrders` — use `/api/orders/[id]`.
- Store contact + KYC live in `merchants/{id}/private/contact`; never put email/phone on the public store doc.
- Merchant dashboard pages take the store from `useMerchantScope()` (admins view any store read-only), not `useAuth().user`.
- Checkout and store applications require a verified email.
- After catalog writes, revalidate the `catalog` cache tag.
- Home page layout/copy lives in `settings/storefront` (`getStorefront`, edited at /admin/storefront); legal/policy pages in `pages/{slug}` (`src/lib/legal.ts` slugs + built-in text, rendered by `RichText`, never as raw HTML).
- Categories, storefront, legal pages, product moderation and user roles are admin API routes (`/api/admin/*`) that write an `auditLogs` entry; clients never write them.
- A product hidden by an admin (`hiddenByAdmin`) stays `draft` until an admin releases it; merchant edits keep it a draft.
- Tabby/Tamara keys: read only via `getPaymentKeys()` (`src/lib/server/payment-config.ts`: `secrets/payments` set at /admin/payments, env fallback, 30 s cache). Never return secrets in full or put them in audit logs; provider API hosts are allow-listed.
- Abuse-prone endpoints call `rateLimit(bucket, uid, n)` (`src/lib/server/rate-limit.ts`).
- Public pages set `alternates(lang, path)` from `src/lib/seo.ts` in `generateMetadata`; add new public routes to `src/app/sitemap.ts`.
- Demo mode = no Firebase keys (development only). `PAYMENTS_DEMO` is ignored in production and `src/instrumentation.ts` refuses to boot with it.
- Any change to `firestore.rules`/`storage.rules` needs a matching test in `tests/rules/`.

## Conventions
- Files kebab-case; components PascalCase; `@/` alias for `src/`
- Client components start with `"use client"`; server modules import `"server-only"`
- Commits: short imperative subject
- Roadmap: demo → real marketplace plan (milestones M0–M8) — security & money first, then Arabic/RTL, VAT/refunds, customer/merchant/admin features, responsive pass, launch.
