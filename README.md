# memo — marketplace with pay-in-4 on every store

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Firebase (Auth, Firestore, Storage) · Tailwind v4 · Motion.

## How the money flows

```
Customer ──pays──▶ YOUR Tabby / Tamara account (platform keys)
                      │
                      ▼  webhook / return URL → /api/payments/*  (server verifies with the provider, then captures)
               orders/{id}           ← one per checkout
               merchantOrders/{id}   ← one per (order × store) = the payout ledger
                      │                 subtotal − commission − BNPL fee = payoutAmount
                      ▼
Admin › Payouts: send the bank transfer, enter the reference → payouts/{id}, rows marked paid
```

* Merchants never need their own Tabby or Tamara contract. Every checkout uses the platform's keys.
* Prices are re-read on the server, never taken from the browser. Commission and fee rates are snapshotted on each ledger row.
* **Admin › Transactions** shows who bought what, through which provider, and what each store is owed. It also exports to CSV.
* **Admin › Payouts** groups unpaid rows by store, shows the store's IBAN, and records each transfer.

## Routes

All pages work at `/ar/...` and `/en/...` (Arabic is the default; unprefixed links keep the shopper's language).

| Area | Path |
| --- | --- |
| Storefront | `/`, `/shop` (search, filters), `/category/[slug]`, `/product/[id]`, `/store/[slug]`, `/checkout`, `/sell` |
| Account | `/account` (profile, addresses), `/account/orders/[id]` (+ `/invoice`), `/account/wishlist` |
| Policies | `/legal/terms`, `/legal/privacy`, `/legal/returns`, `/legal/shipping`, `/legal/merchant-terms` |
| Merchant | `/merchant`: overview, products, orders and fulfilment, payouts, reviews, store and bank settings |
| Admin | `/admin`: overview, transactions (CSV), payouts, stores, product moderation, storefront editor, categories, legal pages, users, audit log, settings |
| SEO | `/sitemap.xml`, `/robots.txt` |

## Run it

```bash
npm install
npm run dev
```

With no `.env.local`, the app runs in **demo mode**: the storefront uses sample data, and `/login` lets you enter as Admin, Merchant or Customer.

**Full local test against Firebase emulators** (real Auth, Firestore and Storage rules, nothing touches your project; needs Java):

```bash
npm run emulators      # terminal 1, keep running
npm run emulator:seed  # test accounts admin@ / store@ / shopper@memo.test, password memo-test-1234
npm run dev:emulator   # http://localhost:3005
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:rules` (Firestore + Storage emulators, needs Java), `npm run build`.

## Go live: production checklist

**Firebase**
- [ ] Create a Firebase project. Enable **Email/Password** and **Google** sign-in, **Firestore** and **Storage**.
- [ ] Fill `.env.local` (or your host's env settings) from `.env.example`: the six `NEXT_PUBLIC_FIREBASE_*` web keys and the `FIREBASE_*` service-account key. If your Google Cloud organization blocks keys, set `FIREBASE_USE_ADC=true` instead: locally run `gcloud auth application-default login` and set `GOOGLE_CLOUD_QUOTA_PROJECT`; in production host on Cloud Run or Firebase App Hosting, which provide the credentials automatically. Check with `npm run check:firebase`.
- [ ] Deploy rules and indexes: `npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage`. Redeploy whenever `firestore.rules`, `storage.rules` or `firestore.indexes.json` change.
- The TTL policy that deletes old rate-limit counters (`rateLimits.expireAt`) is part of `firestore.indexes.json`, so the deploy above sets it up.
- [ ] Seed categories and settings: `npm run seed` (add `-- --samples` only on a staging project).

**Accounts**
- [ ] `ADMIN_EMAILS`: your admin email(s). Sign in once; the admin role is granted when the email is verified (Google counts as verified). More admins can be added later in **Admin › Users**.

**Site**
- [ ] `NEXT_PUBLIC_APP_URL` = your public https address (used for payment redirects, webhooks, canonical links and the sitemap). The server refuses to start in production without it.
- [ ] `PAYMENTS_DEMO` is **unset** (the server refuses to start in production if it is set).
- [ ] `CRON_SECRET` set, and `/api/cron/expire-orders` called every 15 minutes with `Authorization: Bearer $CRON_SECRET`. On Firebase App Hosting use a Cloud Scheduler job (see "Deploy on Firebase App Hosting"); on Vercel, `vercel.json` schedules it.

### Deploy on Firebase App Hosting

`apphosting.yaml` holds the production config. Server credentials come from the backend's service account, so no key file is needed. Requires the Blaze plan.

1. Create the secrets (each command also grants the backend access): `npx firebase apphosting:secrets:set ADMIN_EMAILS` and `npx firebase apphosting:secrets:set CRON_SECRET`.
2. Create the backend from the Firebase console (App Hosting → Get started), connect the GitHub repo, branch `main`, root `/`, backend ID `memo`, region `europe-west4`. A different ID or region changes the URL, so update `NEXT_PUBLIC_APP_URL` in `apphosting.yaml` to match.
3. Every push to `main` rolls out. Open the URL, sign in with an `ADMIN_EMAILS` account.
4. Schedule the cron:
   ```
   gcloud scheduler jobs create http expire-orders --project memo-3f85d --location europe-west4 --schedule "*/15 * * * *" --http-method GET --uri "https://memo--memo-3f85d.europe-west4.hosted.app/api/cron/expire-orders" --headers "Authorization=Bearer <CRON_SECRET>"
   ```

**Payments (Admin › Payments)** — paste the keys there; they are stored server-side only (Firestore `secrets/payments`, closed to all clients), shown masked, and saving needs a sign-in from the last 10 minutes. The environment variables below still work as a fallback.

**Tabby**
- [ ] `TABBY_SECRET_KEY`, `TABBY_MERCHANT_CODE`, `TABBY_API_URL`.
- [ ] Webhook: click **Register webhook with Tabby** in Admin › Payments (needs the public https address). The script `scripts/register-tabby-webhook.ts` does the same from env vars.

**Tamara**
- [ ] `TAMARA_API_TOKEN`, `TAMARA_API_URL` (`https://api.tamara.co` in production), `TAMARA_NOTIFICATION_TOKEN`. The notification URL is sent with every checkout.

**In the admin dashboard**
- [ ] **Settings**: commission, your Tabby and Tamara fee rates, VAT number and legal name for invoices, payout hold days.
- [ ] **Legal pages**: replace the built-in texts (terms, privacy, returns, delivery, merchant terms) with lawyer-reviewed wording.
- [ ] **Storefront**: home page headline, featured products and categories, promo banner.
- [ ] Place one real order with each provider, then refund it, to confirm webhooks and refunds work against your accounts.

> Check field names against the latest Tabby and Tamara API docs before going live. The integration lives in `src/lib/payments/`.

## Not included yet

Shipping fees (delivery is free), transactional emails beyond Firebase's own verification and password-reset mails, automatic bank transfers (payouts are recorded by hand after you send the transfer), and full ZATCA phase-2 (Fatoora) e-invoicing.
