# Roamwell — travel eSIMs and verification numbers

A marketplace for international travel eSIMs (data-only), one-time SMS verification numbers
and longer-term number rentals. Customers pay through a hosted payment page. Orders are fulfilled
from a supplier API in the background, and staff run the business from an admin console.

> **Status:** feature-complete and tested end to end in **sandbox mode** (simulated supplier
> and payment gateway). It has **not** been run against the live 1001SMS or Paystack APIs.
> See [docs/INTEGRATION_STATUS.md](docs/INTEGRATION_STATUS.md) for exactly what is verified
> and what blocks a live launch.

## Stack

Next.js 16 (App Router, TypeScript strict) · React 19 · Tailwind CSS v4 + shadcn/ui ·
PostgreSQL + Prisma 7 · Better Auth · Zod · decimal.js · Vitest · Playwright.

## Features

- **Storefront:** browse eSIMs by country and plan, verification numbers by country and service, number rentals.
  Prices come from the live supplier cost plus your margin rules.
- **Accounts:** email + password with verification, password reset, TOTP 2FA, session management.
- **Checkout:** server-side pricing, purchase limits, idempotent orders, hosted payment page,
  server-side payment verification.
- **Fulfilment:** background job queue with retries; uncertain supplier outcomes are reconciled, never blindly retried;
  failed purchases are refunded automatically.
- **Customer dashboard:** orders, eSIMs with an installation QR code and iPhone/Android steps,
  live SMS inbox for verification numbers, rentals, transactions, refunds, support tickets.
- **Admin console** (role-based: support, finance, admin): orders, fulfilment retry and verified
  manual linking, refunds, users and roles, catalogue visibility, margin rules, exchange rates, promotions,
  supplier balance and sync, integrations health, profit report, audit log, settings.
- **Money safety:** double-entry append-only ledger, refunds confirmed by the gateway, exact amount matching.
- **Data protection:** AES-256-GCM for activation codes and SMS, log redaction, retention job.

## Quick start (local, sandbox mode)

Requires Node 24, pnpm 11 and Docker.

```bash
pnpm install
docker compose up -d                # PostgreSQL on localhost:55433
cp .env.example .env                # then fill BETTER_AUTH_SECRET, DATA_ENCRYPTION_KEY, SANDBOX_SIGNING_SECRET
pnpm db:migrate                     # apply migrations
pnpm db:seed                        # demo catalogue + default margin rules
pnpm dev                            # http://localhost:3000
```

Sandbox mode (`SUPPLIER_MODE=sandbox`, `PAYMENT_PROVIDER=sandbox`) needs no external accounts.
Every demo item is labelled **DEMO**, the payment page simulates success or decline, and demo eSIM codes cannot be installed.
Verification emails are captured at **http://localhost:3000/dev/mailbox**.

To make yourself an admin after registering:

```bash
pnpm admin:grant you@example.com admin
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Develop, build (generates the Prisma client), serve |
| `pnpm typecheck` | Route type generation + `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (no database) |
| `pnpm test:integration` | Integration tests against a database named `esim_test` |
| `pnpm build && pnpm test:e2e` | Playwright end-to-end tests on port 3100 (sandbox mode) |
| `pnpm db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma |
| `pnpm admin:grant <email> <role>` | Grant `user`, `support`, `finance` or `admin` |

Integration tests refuse to run unless the database name contains `esim_test` (override with `TEST_DATABASE_URL`).
Create and migrate it once:

```bash
docker exec esim-marketplace-postgres createdb -U esim esim_test
DATABASE_URL="postgresql://esim:esim_dev_password@localhost:55433/esim_test" pnpm db:deploy
```

## Project layout

```
src/app/            routes: (public), (auth), dashboard, checkout, admin, api
src/server/         server-only domain code
  providers/        supplier (1001SMS, sandbox) and payment (Paystack, sandbox) adapters
  orders/ payments/ fulfilment/ refunds/ verification/   business flows
  jobs/ webhooks/   queue, scheduler, webhook ingestion
  pricing/ catalog/ ledger.ts audit.ts crypto.ts env.ts
src/components/     UI (shadcn primitives in components/ui)
prisma/             schema, migrations, seed
tests/ e2e/         integration and Playwright tests (unit tests sit next to the code)
docs/               design and operations documents
```

## Documentation

| Document | Contents |
|---|---|
| [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md) | Phases, what each delivered, checks run |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Components, data model, order/payment/fulfilment flows |
| [INTEGRATION_STATUS](docs/INTEGRATION_STATUS.md) | Verified vs untested vs blocked, per provider |
| [PROVIDER_COMPARISON](docs/PROVIDER_COMPARISON.md) | Supplier and gateway options considered |
| [SECURITY](docs/SECURITY.md) | Controls, rate limits, known gaps |
| [DEPLOYMENT](docs/DEPLOYMENT.md) | Environment, migrations, Vercel, post-deploy steps |
| [OPERATIONS](docs/OPERATIONS.md) | Daily checks, jobs, order states, refunds, incidents |
| [PRODUCTION_READINESS](docs/PRODUCTION_READINESS.md) | Verdict, launch blockers and the exact actions to clear them |
