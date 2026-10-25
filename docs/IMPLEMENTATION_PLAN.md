# Implementation Plan

## Repository audit (2026-10-22)

- `e:\onion\esim` was **empty** (no files, no git history). The GitHub remote
  `10954065/esim-build-` was empty.
- Tooling available: Node 24.18, pnpm 11.13, Docker 29, gh CLI (authenticated).
- Other PostgreSQL containers already used ports 5432/54329/55432 on the host; this project
  uses its own container on **55433** (`docker-compose.yml`) so existing databases are untouched.
- Decision: initialize with `create-next-app@16.4.2` (TypeScript strict, Tailwind v4, App Router,
  `src/`), shadcn/ui (Radix base), Prisma 7.10.1, Better Auth 1.7.

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | Audit & foundation: scaffold, security headers, env validation, logger, field encryption, Prisma schema + initial migration (with ledger immutability trigger), design tokens, docs | ✅ |
| 2 | Provider layer (1001SMS + sandbox), catalogue sync, pricing engine, public browsing | ✅ |
| 3 | Auth, customer dashboard, eSIM detail/QR, verification sessions, rentals, notifications | ✅ |
| 4 | Payments (Paystack + sandbox), webhooks, fulfilment jobs, reconciliation, refunds, ledger | ✅ |
| 5 | Admin dashboard: orders, users, catalogue, pricing, suppliers, payments, refunds, support, analytics, audit, settings | ✅ |
| 6 | Unit, integration and E2E tests; security review; mobile layout checks | ✅ |
| 7 | Deployment docs, operations runbook, readiness report | ✅ |

Each phase is committed and pushed to `main` when its checks pass.

## Phase 2 notes

- `src/server/providers/supplier/` — provider contracts, 1001SMS adapter (client, schemas, mappers,
  webhook verifier) and a stateless sandbox adapter.
- `src/server/pricing/` — decimal-safe money helpers, pure pricing engine, DB pricing session.
- `src/server/catalog/` — sync (with `CatalogSyncLog`), TTL-based freshness, priced read models.
- Public pages: `/`, `/esims`, `/esims/[country]`, `/esims/[country]/[plan]`, `/verification`,
  `/verification/[country]`, `/verification/[country]/[service]`, `/numbers/rentals`.
- Checks: typecheck ✅, lint ✅, 68 unit tests ✅, production build ✅, smoke test of every public
  route against the seeded sandbox catalogue ✅.

## Phase 3 notes

- Better Auth: email/password with mandatory verification, reset (1 h tokens, revokes sessions),
  TOTP 2FA with lockout columns, admin plugin, DB-backed rate limits, security emails.
- Registration via server action (terms acceptance recorded, IP/email rate limits, no enumeration).
- `requireUser` / `requireStaff` / `assertPermission` server guards; proxy is an optimistic redirect only.
- Customer dashboard: overview, orders, eSIMs (server-rendered QR from the decrypted LPA string,
  iPhone/Android steps, manual details), verification sessions, rentals, transactions, refunds,
  profile + deletion request, security (password, 2FA, sessions), support tickets.
- Content pages: how it works, device compatibility, help, FAQ (with FAQPage JSON-LD), contact,
  terms, privacy (renders `src/lib/retention.ts`), refund policy, acceptable use; dev mailbox.
- Verified against a running build: sign-up → verification email → session → dashboard (all pages
  200); foreign order id → 404; `/admin` as customer → 404; 6th bad sign-in → 429; origin check → 403.

## Phase 4 notes

- Order state machine (pure, tested) + `transitionOrder` with conditional updates and history.
- Payment gateway abstraction: Paystack adapter (initialize / verify / refund / signed webhooks)
  and a sandbox gateway with its own charge/refund records.
- Checkout: live supplier re-validation, server pricing, purchase limits, idempotency key,
  gateway initialisation outside DB transactions; sandbox hosted-page simulator; return page
  verifies server-side.
- `confirmPayment`: server-side verify, exact amount/currency match, idempotent SUCCEEDED update,
  ledger journals, fulfilment jobs; late payments on cancelled orders are refunded.
- Postgres job queue (SKIP LOCKED, backoff + jitter, DEAD state), recurring scheduler, cron route.
- Fulfilment: claim-before-call, UNCERTAIN → reconciliation against supplier order lists (never a
  blind retry), operator errors → review, definite failures → automatic refund; admin retry and
  verified manual linking.
- Verification: webhook + polling, encrypted SMS, cancel → supplier-confirmed refund, expiry sweep.
- Refunds: REQUESTED → PENDING → COMPLETED only on gateway confirmation; uncertain submissions
  reconciled via the gateway's refund list; never exceeds captured amount.
- Retention job enforcing `src/lib/retention.ts`.
- Tests: 75 unit + 12 integration tests (real Postgres, sandbox providers) all passing.

## Phase 5 notes

- 18 admin routes behind `requireStaff` + per-page permissions; navigation filtered by role.
- Order console: fulfilment state and supplier errors, retry, verified manual supplier linking
  (the supplier order is fetched and matched — no "mark fulfilled" button), staff refunds with
  idempotency nonce, status history, ledger entries.
- Users: role changes and suspensions (sign-out everywhere, audited); CLI `pnpm admin:grant`.
- Catalogue/pricing: visibility toggles, margin rules, staff-entered exchange rates with source,
  promotions; products show cost, customer price and margin.
- Profit report from the ledger: gross sales, refunds, supplier cost, gross profit, fees,
  net contribution (clearly not net profit); by category, country, day, month; success rate.
- Integrations: masked configuration, webhook/job/email stats, dead-job retry.
- Smoke-tested on a production build: all admin pages 200 for admin; 404 for customers.

## Phase 6 notes

- Playwright suite (`e2e/marketplace.spec.ts`) against a production build in sandbox mode on port 3100:
  1. register → verify email (dev mailbox) → buy an eSIM → order completes → QR code and manual details shown;
  2. buy a verification number → simulated SMS appears → a second customer gets 404 on that session;
  3. declined payment → no product created;
  4. guest redirected to sign-in, customer gets 404 on `/admin`, cron rejects requests without the secret;
  5. phone viewport (Pixel 7): no horizontal overflow, mobile navigation works.
- Order detail page processes due jobs after responding, so fulfilment does not wait for the next cron tick.
- Security review fixes: `/api/cron/jobs` now requires `CRON_SECRET` in every environment except
  development/test (staging was open before); `shadcn` CLI moved to devDependencies, so
  `pnpm audit --prod` is clean.
- Docs: SECURITY, OPERATIONS, DEPLOYMENT, README.
- Checks: typecheck ✅, lint ✅, 80 unit ✅, 12 integration ✅, 5 E2E ✅, `pnpm audit --prod` ✅.

## Phase 7 notes

- `docs/PRODUCTION_READINESS.md`: verdict, evidence, four launch blockers with owners and exact
  actions, pre-launch checklist, supervised go-live sequence, accepted limitations.
- DEPLOYMENT.md and OPERATIONS.md (written in Phase 6) cover environment, migrations, post-deploy
  steps, jobs, order states, refunds and incident playbooks.

## Hardening (after Phase 7)

Coverage was measured for the first time (57% of lines) and raised to 85% with tests aimed at the
riskiest paths. Writing them found and fixed three defects:

1. **Verification refund could be lost.** If a customer's cancellation reached the supplier but the
   response timed out, the session was rolled back to "waiting"; the next poll saw the supplier's refund
   and closed the session as refunded **without refunding the customer**. Polling now refunds the
   customer whenever the supplier has refunded an undelivered number (idempotent per session).
2. **Manual supplier linking** relied on a database constraint to stop one supplier order being linked
   to two customer orders (raw error to staff). It now refuses explicitly, and also checks the country
   of verification activations.
3. **Profit report** counted demo orders in revenue but not in order counts. Demo data is now included
   only while the deployment itself runs in sandbox mode, for both money and counts.

Also: Paystack and 1001SMS adapters unit-tested against documented shapes; E2E runs reset rate-limit
windows (repeated local runs hit the real sign-up limit); coverage thresholds in `vitest.config.mts`;
GitHub Actions CI (green on first run; actions on current majors).

**Encryption key rotation** (was security gap 5): `DATA_ENCRYPTION_KEYS_PREVIOUS` keeps retired keys
readable, and `pnpm data:reencrypt` moves stored secrets to the new key. It is resumable and never
overwrites a row that changed during the run. Procedure in SECURITY.md.

Checks: 185 unit ✅, 53 integration ✅, 5 E2E ✅, typecheck ✅, lint ✅, coverage 85.4% lines.

## UI redesign (Stitch "Precision Global Transit" design)

The storefront and customer dashboard now follow the GlobeLink Stitch design's pattern and theme:
Inter type, midnight ink `#101828`, action blue `#3867F6`, mint/amber/red status pills with dots,
slate canvas with white hairline-bordered cards and navy-tinted shadows (`shadow-card/raised/float/modal`),
segmented tabs, dark active filter chips, uppercase eyebrows, breadcrumbs and sticky order summaries.

- **Flags:** every country shows its SVG flag (`country-flag-icons`, MIT). Flags are prebuilt as static,
  immutable-cached files at `/flags/<iso>.svg` and rendered by `src/components/common/flag.tsx`; regional
  and global destinations show a globe/map icon. Emoji flags (which Windows renders as letters) are gone.
- **Pages:** home (hero, product finder with flag quick-picks, product lines, top destinations, how it works,
  trust, FAQ, CTA), eSIM catalogue, destination (plan list + before-you-buy), plan (spec tiles, install
  walkthrough, order summary), verification steps 1–3 (country picker, service inventory, route table),
  rentals, dashboard shell (sidebar), overview (stat cards, orders table with flags) and orders.
- **Honesty:** the design's invented figures (latency, success rates, "200+ nations", wallet, top-ups,
  compliance badges) were not copied; stats shown are live catalogue counts, and delivery rates are labelled
  as supplier-reported.
- Checks: 360 px overflow audit of every public page (fixed grid min-content blow-out and an escaping
  `sr-only` table header), typecheck ✅, lint ✅, 185 unit ✅, 53 integration ✅, 5 E2E ✅.

## Next task

None in code. Launch depends on the blockers in PRODUCTION_READINESS.md.
