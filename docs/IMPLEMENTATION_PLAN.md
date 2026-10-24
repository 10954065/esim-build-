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
| 2 | Provider layer (1001SMS + sandbox), catalogue sync, pricing engine, public browsing | ⏳ |
| 3 | Auth, customer dashboard, eSIM detail/QR, verification sessions, rentals, notifications | ⏳ |
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

## Next task

Phase 3 — Better Auth (email/password, verification, reset, 2FA for staff), customer dashboard,
remaining public content pages.
