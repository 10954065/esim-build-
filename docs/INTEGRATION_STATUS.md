# Integration Status

This document states exactly what has been verified, what has been tested, and what is
blocked. It must be kept truthful: an integration is **not** "done" because a client exists.

Legend: ✅ verified/tested · 🟡 implemented, untested against the live service · ⛔ blocked

## Supplier — 1001SMS (primary)

| Item | Status | Notes |
|---|---|---|
| API reference reviewed | ✅ | `https://www.1001sms.com/api-docs` read on 2026-10-22 (endpoints, fields, webhook signing). |
| Adapter implemented (`src/server/providers/supplier/sms1001/`) | 🟡 | Built strictly from the documented request/response shapes. Never called against the live API. |
| Webhook signature verification | 🟡 | HMAC-SHA256 over `t.rawBody`, 5-minute tolerance, constant-time compare — unit-tested against the documented algorithm, not against a real delivery. |
| Live API key | ⛔ | Not provided. Needs a key with scopes `read`, `activate`, `numbers`, `esim`. |
| Webhook endpoint registration | ⛔ | After deploy: `PUT /webhooks/config` with `url=https://<domain>/api/webhooks/supplier/1001sms` and events `sms.received, esim.allocated, esim.updated, esim.failed, esim.refunded, number.expired, number.cancelled, number.expiring`. Store the returned `secret` in `SMS1001_WEBHOOK_SECRET`. |
| Price currency | ⛔ | Not stated in docs. Confirm with 1001SMS and set `SUPPLIER_PRICE_CURRENCY`. |
| Resale & verification-use terms | ⛔ | Not published. Obtain written permission to resell eSIMs, activations and rentals. |
| Idempotent ordering | ⛔ (supplier limitation) | Not offered. Mitigated by reconciliation + manual review (ARCHITECTURE.md). |
| eSIM top-ups | Not implemented | Not documented by 1001SMS. UI never offers top-ups. |
| Sandbox adapter | ✅ | `SUPPLIER_MODE=sandbox`: deterministic fixtures, every record flagged `isSandbox`, demo LPA strings use the reserved `.invalid` domain so they cannot install. Forbidden in production by env validation. |

## Payments — Paystack (candidate) + Sandbox

| Item | Status | Notes |
|---|---|---|
| Adapter implemented (`src/server/providers/payment/paystack.ts`) | 🟡 | Initialize → hosted checkout redirect; server-side `GET /transaction/verify/:reference`; `POST /refund`; webhook HMAC-SHA512 of raw body with secret key (`x-paystack-signature`). |
| Official docs access | 🟡 | paystack.com/docs returned HTTP 403 to automated fetch on 2026-10-22; signature scheme confirmed only via third-party references. Re-verify against official docs before go-live. |
| Merchant eligibility | ⛔ **Launch blocker** | Paystack's "International payment eligibility" article lists **"Data resellers"** and **"Instant value businesses (airtime sellers …)"** as ineligible for international payments in all countries. Travel eSIMs are data resale. Written approval from Paystack is required before accepting international cards; local GHS acceptance must also be confirmed for this category. |
| Settlement currency | ⛔ | Configure `PAYMENT_CURRENCY` to a currency enabled on the merchant account (GHS by default for Ghana merchants; USD only if enabled). |
| Live/test keys | ⛔ | Not provided. |
| Sandbox gateway | ✅ | `PAYMENT_PROVIDER=sandbox`: a local test checkout page posts a signed webhook to the same processing path as real payments. Paired with the sandbox supplier only. |

## Email — Resend

| Item | Status | Notes |
|---|---|---|
| Adapter | 🟡 | REST call to `POST https://api.resend.com/emails`. Not tested with a real key. |
| Dev "log" provider | ✅ | Stores rendered emails in `EmailDelivery.devPreview` and exposes them at `/dev/mailbox` (disabled outside development/test). |
| Sender domain verification | ⛔ | Requires a verified domain at the provider. |

## Authentication — Better Auth

| Item | Status |
|---|---|
| Email + password, verification, reset, sessions, 2FA (TOTP) for staff | ✅ (local) |
| Google OAuth | Optional — enabled only when `GOOGLE_CLIENT_ID/SECRET` are set; not tested. |

## Test evidence (2026-10-24)

| Suite | Result | Scope |
|---|---|---|
| Unit (Vitest) | ✅ 80 / 80 | Pricing, money, signatures, 1001SMS mappers/client, sandbox adapter, crypto, env guards, logger, state machine, permissions |
| Integration (Vitest + Postgres) | ✅ 12 / 12 | Payment confirmation, forged/duplicate webhooks, amount mismatch, supplier failure → refund, SMS ownership, cancel → refund, checkout idempotency, late payment, rentals |
| E2E (Playwright, production build) | ✅ 5 / 5 | eSIM purchase to QR, verification SMS + isolation, declined payment, access control, mobile layout |

All three suites use the **sandbox** supplier and gateway. None of them prove the live 1001SMS or Paystack integration.

_This file is updated at the end of every implementation phase._
