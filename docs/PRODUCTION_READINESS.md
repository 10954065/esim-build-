# Production Readiness Report

_Date: 2026-10-24 · Commit: Phase 7 on `main`_

## Verdict

**Ready for a staging deployment in sandbox mode. Not ready to take real customer money.**

The software is complete and passes every check it can pass without external accounts.
Four launch blockers remain. All of them are **business or account actions**, not code:
supplier credentials and terms, payment-gateway eligibility, an email domain, and a scheduler.
The live supplier and payment adapters exist but have never been exercised against the real APIs,
so the first live transactions must be supervised (see "Go-live sequence").

## Evidence

| Check | Result |
|---|---|
| TypeScript strict (`pnpm typecheck`) | ✅ no errors |
| ESLint | ✅ no warnings |
| Unit tests | ✅ 80 / 80 |
| Integration tests (real Postgres, sandbox providers) | ✅ 12 / 12 |
| E2E (Playwright, production build, desktop + Pixel 7) | ✅ 5 / 5 |
| Production build | ✅ |
| `pnpm audit --prod` | ✅ no known vulnerabilities |
| Manual checks on a running build | ✅ auth flow, all customer and admin pages, IDOR → 404, auth rate limit → 429, origin check → 403, cron without secret → 401 |

## Launch blockers

| # | Blocker | Owner | Exact action to clear it |
|---|---|---|---|
| 1 | **Paystack merchant eligibility.** Paystack lists "data resellers" and "instant value" businesses as ineligible for international payments. | Business | Contact Paystack support with a description of the business (travel eSIM + verification numbers) and get **written** approval for card payments, including international cards if you sell to travellers from abroad. Confirm the settlement currency. If refused, choose another gateway from PROVIDER_COMPARISON.md and add an adapter in `src/server/providers/payment/` (the interface is already gateway-neutral). |
| 2 | **1001SMS live access and terms.** | Business | (a) Create an API key with scopes `read`, `activate`, `numbers`, `esim` → `SMS1001_API_KEY`. (b) Ask 1001SMS which currency its prices use → `SUPPLIER_PRICE_CURRENCY`. (c) Get written permission to **resell** eSIMs, activations and rentals. (d) After deploying, register the webhook (DEPLOYMENT.md §5.4) → `SMS1001_WEBHOOK_SECRET`. (e) Fund the supplier balance. |
| 3 | **Transactional email.** | Engineering | Create a Resend account, verify your sending domain (SPF + DKIM), then set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `EMAIL_FROM`. Without this nobody can verify an account, so nobody can buy. |
| 4 | **Every-minute scheduler.** | Engineering | Use Vercel Pro (the cron in `vercel.json` then works as is), or call `/api/cron/jobs` every minute from an external scheduler with the bearer secret (DEPLOYMENT.md §6). |

## Before launch (strongly recommended, not blocking)

- [ ] Verify Paystack's webhook signature and verify-endpoint responses against the **official** docs
      and one real test-mode transaction (they were implemented from third-party descriptions).
- [ ] Run the first purchases of each product type in **live** mode with a staff account, and compare
      the 1001SMS responses with the adapter's schemas (`src/server/providers/supplier/sms1001/schemas.ts`).
      A schema mismatch on a purchase is treated as an **uncertain** outcome (reconciled, then sent to staff review,
      never retried blindly), so it cannot double-charge the supplier. But every such order needs a manual decision, so fix mismatches before opening to the public.
- [ ] Legal review of `/terms`, `/privacy`, `/refund-policy`, `/acceptable-use`. They are drafts written
      for this product, not legal advice. Add company name, address and governing law.
- [ ] Turn on Vercel Firewall / BotID rate rules for `/register`, `/login` and `/checkout`.
- [ ] Uptime monitor on `/api/health`; error alerts from logs (OPERATIONS.md, "Monitoring").
- [ ] Back up `DATA_ENCRYPTION_KEY` offline, and enable point-in-time recovery on the database.
- [ ] Create margin rules and exchange rates (DEPLOYMENT.md §5.7) and check that a few sample prices are sensible.

## Go-live sequence

1. Deploy to production with `PAYMENT_PROVIDER=paystack` and **test** keys, `SUPPLIER_MODE=live`,
   and `store.purchasesEnabled=false` (`/admin/settings`).
2. Run migrations, create the first admin, enable 2FA, register both webhooks, sync the catalogue.
3. Switch to Paystack **live** keys. Turn purchases on, buy one eSIM and one verification number as staff, then refund one.
   Check `/admin/orders`, the ledger entries, the emails and `/admin/integrations`.
4. Open to the public. For the first week, check `NEEDS_REVIEW` orders and dead jobs twice a day.

## Known limitations (accepted for v1)

| Limitation | Impact | Mitigation |
|---|---|---|
| Supplier has no idempotency keys | A timeout during purchase leaves the outcome unknown | Reconciled against the supplier's order list; staff review; never auto-retried |
| No eSIM top-ups | Customers buy a new plan instead | Not offered in the UI (supplier does not document top-ups) |
| CSP allows inline scripts | Weaker XSS defence-in-depth | No user HTML is rendered; nonce CSP is a later improvement |
| Exchange rates entered manually | Margins drift if rates are not updated | Prices are floored at converted cost, so the shop never sells below cost |
| Account deletion is a manual request | Staff must process it | Financial records must be kept for 7 years anyway |
| Single region, single database | An outage takes the shop down | Health check + managed Postgres PITR |

## Environment variables

See `.env.example` (all documented) and DEPLOYMENT.md §2 for production values.
Required in production: `APP_ENV`, `APP_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `DATABASE_URL`,
`DATA_ENCRYPTION_KEY`, `SUPPLIER_MODE`, `SMS1001_API_KEY`, `SMS1001_WEBHOOK_SECRET`, `SUPPLIER_PRICE_CURRENCY`,
`PAYMENT_PROVIDER`, `PAYSTACK_SECRET_KEY`, `PAYMENT_CURRENCY`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`.
