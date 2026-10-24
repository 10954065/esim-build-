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
| 4 | Payments (Paystack + sandbox), webhooks, fulfilment jobs, reconciliation, refunds, ledger | ⏳ |
| 5 | Admin dashboard: orders, users, catalogue, pricing, suppliers, payments, refunds, support, analytics, audit, settings | ⏳ |
| 6 | Unit, integration and E2E tests; security review; mobile layout checks | ⏳ |
| 7 | Deployment docs, operations runbook, readiness report | ⏳ |

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

## Next task

Phase 4 — checkout, payments (Paystack + sandbox), webhooks, job queue, fulfilment and
reconciliation, verification polling/cancel, refunds, ledger, notifications.
