# Architecture

## Overview

A single Next.js (App Router) application deployed on a Node.js runtime, backed by
PostgreSQL through Prisma. There is deliberately **no** Redis, message broker or separate
backend service: durable background work runs from a Postgres job table, triggered by cron
and by request-time kicks.

```
Browser ──► Next.js (RSC pages, server actions, route handlers)
              │
              ├── src/server/*          server-only business logic
              │     ├── providers/supplier   1001SMS adapter | sandbox adapter
              │     ├── providers/payment    Paystack adapter | sandbox gateway
              │     ├── providers/email      Resend | dev log
              │     ├── catalog/             sync + on-demand freshness
              │     ├── pricing/             decimal-safe margin engine
              │     ├── orders/              checkout + state machine
              │     ├── fulfilment/          idempotent supplier submission + reconciliation
              │     ├── payments/            verification, webhook processing
              │     ├── refunds/  ledger/    financial workflows (append-only ledger)
              │     ├── jobs/                Postgres queue (SKIP LOCKED) + handlers
              │     └── auth/ audit/ ratelimit/ notifications/ support/ reports/
              │
              └── PostgreSQL (Prisma 7 + @prisma/adapter-pg)

Supplier (1001SMS) ──signed webhooks──► /api/webhooks/supplier/1001sms
Gateway (Paystack) ──signed webhooks──► /api/webhooks/paystack
Vercel Cron ─────────Bearer CRON_SECRET─► /api/cron/*
```

## Key decisions

| Decision | Rationale |
|---|---|
| Next.js 16 App Router, `cacheComponents: false` | Nearly every page is per-user or DB-backed. The pre-Cache-Components model (explicit `dynamic`) is predictable; catalogue freshness is managed in the database instead of the framework cache. |
| Prisma 7.10.1 (not 8.x RC) | `prisma@latest` was a release candidate on 2026-10-22; the stable 7.x line was pinned. |
| Better Auth | Mature, self-hosted, Prisma adapter, email verification, password reset, DB sessions, TOTP 2FA plugin, admin plugin (ban/impersonation). |
| One primary supplier (1001SMS) | Single API covers eSIMs, activations and rentals (docs/PROVIDER_COMPARISON.md). |
| Provider interfaces + adapters | `EsimProvider`, `VerificationNumberProvider`, `RentalNumberProvider`, `SupplierAccountProvider`, `SupplierWebhookVerifier`; normalized internal models; supplier JSON never leaves the adapter. |
| Postgres job queue | Durable, retryable, observable without extra infrastructure. Claimed with `FOR UPDATE SKIP LOCKED`; exponential backoff with jitter; `DEAD` state after `maxAttempts`. |
| No customer wallet | Stored balances add regulatory, refund and reconciliation burden with little benefit for one-off purchases. Customers pay per order; refunds go back through the gateway. |
| Append-only ledger | `LedgerEntry` is double-entry and protected by a DB trigger that rejects UPDATE/DELETE. |
| Field encryption | eSIM activation codes, QR URLs and SMS bodies/codes are AES-256-GCM encrypted at rest (`DATA_ENCRYPTION_KEY`). |

## Money and pricing

- All amounts are `Decimal(18,4)` with a currency column. Arithmetic uses `decimal.js`; floats are never used for money.
- Supplier cost is in `SUPPLIER_PRICE_CURRENCY`; customers pay in `PAYMENT_CURRENCY`.
  If they differ, the latest **staff-entered** `ExchangeRate` (with source) is used; if none
  exists or it is older than the configured max age, the product is **not purchasable**.
- Price = cost (converted) → markup (percent + fixed, from the most specific `PricingRule`) →
  minimum-profit floor → promotion → rounded **up** to the currency's minor unit.
- The order stores supplier cost, rate, rule ids and final price (`OrderItem.pricingSnapshot`).
  A checkout price never changes after the order is created; the payment amount is verified
  against it exactly (minor units).

## Order state machine

```
CREATED → AWAITING_PAYMENT → PAID → FULFILLING → FULFILLED
                │                     │   ├──► NEEDS_REVIEW ──► FULFILLING | REFUND_PENDING | FULFILLED (audited manual)
                │                     │   └──► FAILED ──► REFUND_PENDING
                └──► CANCELLED        └────────────────► REFUND_PENDING ──► REFUNDED | PARTIALLY_REFUNDED
FULFILLED ──► REFUND_PENDING (e.g. verification expired with no SMS)
```
Transitions are validated by a pure function (`src/server/orders/state-machine.ts`) and
recorded in `OrderStatusHistory` with actor, reason and timestamp.

## Payment → fulfilment sequence

1. Checkout (server action): re-validate product, re-quote live supplier price where needed,
   compute price on the server, create `Order` + `OrderItem` + `Payment` (INITIALIZED) in one
   transaction, keyed by a client idempotency key. Then (outside the transaction) initialize
   the gateway transaction and redirect to the hosted checkout.
2. Gateway webhook → signature check → `WebhookEvent` insert (unique `(source, eventId)`;
   duplicates acknowledged and ignored) → server-side **verify** call to the gateway → exact
   amount/currency/reference match → `Payment.SUCCEEDED`, `Order.PAID`, ledger journal, and a
   `fulfil-order-item` job enqueued with a unique dedupe key, all in one DB transaction.
   The browser return URL also triggers verification, so a lost webhook still converges.
3. Fulfilment job: claims the `Fulfilment` row with a conditional update
   (`PENDING → SUBMITTING`); only one worker can win. The supplier call happens **outside** any
   DB transaction.
   - Success → store issued product (encrypted), `Fulfilment.SUCCEEDED`, `Order.FULFILLED`,
     supplier-cost journal, notification + email.
   - Definite failure (HTTP 4xx, 402 insufficient balance, 502 "provider failed, charge
     refunded") → retry if retryable (402 → admin alert + NEEDS_REVIEW), else `FAILED` →
     automatic refund.
   - Uncertain (timeout / network error / 5xx without body) → `UNCERTAIN`; a reconcile job
     lists recent supplier orders and links an unambiguous match. Zero or multiple matches →
     `NEEDS_REVIEW`. **No blind resubmission**, 1001SMS has no idempotency key.
4. eSIM orders that return `ready: false` stay `AWAITING_SUPPLIER` until `esim.allocated`
   arrives or polling sees `ready: true`.

## Verification & rentals

- SMS arrive by `sms.received` webhook (primary) and by bounded polling while a session page
  is open (fallback). Messages are matched to activations by supplier order id and stored
  encrypted with the owning `userId`. Duplicate deliveries are ignored by the unique
  `(supplierId, supplierMessageId)` constraint.
- Customer cancellation calls the supplier cancel endpoint; refunds to the customer are only
  created when the supplier confirms a refund (`refundAmount > 0`) and no SMS was received.
- Expired activations with no SMS: the supplier auto-refunds us ~10 minutes after expiry;
  an expiry job confirms supplier status `REFUNDED` before creating the customer refund.
- Rentals are always ordered with `autoRenew: false`: the supplier must never charge our
  balance for a renewal the customer has not paid for.

## Caching

- Public catalogue pages read from the database. Each destination/country has a
  `*SyncedAt` timestamp; stale data triggers an on-demand refresh (bounded by the supplier
  rate limit of 60 req/min) and a background sync job.
- Checkout always re-reads live supplier pricing for verification and rental offers; a
  cached price never overrides the supplier's confirmed order result.
- Customer-specific pages are rendered dynamically and never cached in shared caches.

## Authorization

- Every customer query filters by `userId` from the server session (`requireUser()`),
  including detail pages (`findFirst({ where: { id, userId } })` → 404 when not owned).
- Staff roles: `support`, `finance`, `admin` with an explicit permission matrix
  (`src/server/auth/permissions.ts`). Admin routes check permissions in the layout **and**
  in every server action / route handler.
- Proxy (`src/proxy.ts`) performs only optimistic cookie-presence redirects; it is never the
  security control.
