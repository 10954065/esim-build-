# Supplier Comparison

Last reviewed: 2026-10-22. Sources are the suppliers' public pages as fetched on that date.
"Not documented" means the public material did not state it, it does **not** mean the
capability is absent. Nothing in this table has been tested against a live account.

## Capability matrix

| Capability | 1001SMS | Airalo Partners | Simtasy | ESIMPY | Roamlinx |
|---|---|---|---|---|---|
| Public API reference | **Yes** (`/api-docs`, full endpoint list) | Landing page only; endpoint reference behind partner portal | Yes (`/docs` + OpenAPI at `/api/v1/openapi`) | No public reference on `/wholesale` (points to `/developers`) | No, docs only after partner approval |
| eSIM catalogue | Yes: `GET /esims/destinations`, `GET /esims/packages?location=` | Yes (per marketing) | Yes: `GET /products?country=` | Claimed | Claimed |
| eSIM purchase | Yes: `POST /esims/order` (also `POST /esims/quote`) | Yes (per marketing) | Yes: `POST /orders` | Claimed | Claimed (`POST /api/v1/orderProfiles` shown as example) |
| QR / activation data | Yes: profile `activationCode` (LPA), `qrCodeUrl`, `iccid`, `apn` | Yes (per marketing) | Yes: `lpa_string`, `qr_code_url`, `iccid` | Not documented | Not documented |
| Activation status | Yes: `lifecycle` + profile `status`, `smdpStatus`; `?refresh=1` | Not verified | Yes: `GET /esims/{iccid}` | Not documented | Not documented |
| Usage / top-up | Usage: `usedVolume`/`totalVolume`. Top-up: **not documented** | Not verified | Usage `GET /esims/{iccid}/usage`; top-ups `/esims/{iccid}/topups` | Not documented | Not documented |
| Number inventory | Yes: `GET /informative/pricing` (per-operator `count`, `deliverability`) | No | No | Claimed | Claimed (`/api/v2/virtual-numbers/available` example) |
| Country & service catalogue | Yes: `/informative/countries`, `/informative/services` | n/a | n/a | Claimed | Claimed |
| Temporary SMS activation | Yes: `POST /activations/order` | No | No | Claimed | Not stated |
| Incoming SMS | Polling (`POST /activations/check`, `GET /numbers/{id}/messages`) **and** signed webhook `sms.received` | No | No | Claimed | Signed webhooks (per marketing) |
| Long-term rentals | Yes: `POST /numbers/order`, terms 12h to 365d, renew, cancel | No | No | Yes (core product) | Claimed |
| Rental cancellation | `POST /numbers/{id}/cancel`: unlimited type only, ≤120 min, no SMS received | n/a | n/a | Not documented | Not documented |
| Order status / expiry | Yes: `expiresAt`, `status` (RENTED, COMPLETED, PENDING, EXPIRED, BLOCKED, REFUNDED) | None | `GET /orders/{id}` | Not documented | Not documented |
| Refund / cancel rules | Activation cancel refunds in full only if no SMS arrived; expired orders auto-refund ~10 min after expiry; HTTP 502 = provider failed, charge refunded | Not verified | Not documented | WhatsApp bans not covered | Not documented |
| Supplier wallet / balance | Yes: `GET /informative/balance`; HTTP 402 includes `required` | Not verified | Yes: `GET /wallet` | Prepaid via crypto transfer | Not documented |
| API authentication | `Authorization: Bearer <key>`; scoped keys (`read`, `activate`, `numbers`, `esim`) | OAuth-style access token (per getting-started) | Bearer `sk_live_…` | Partner API key | Not public |
| Rate limits | 60 requests / minute / key (429) | Not verified | Not documented | Not documented | Not documented |
| Webhook authentication | `X-1001SMS-Signature: t=<unix>,v1=<hex>`; HMAC-SHA256 over `<t>.<raw body>`; reject >5 min old; dedupe on event `id`; retries 1m/5m/30m/2h/12h | Not verified | HMAC-SHA256 in `X-Simtasy-Signature` | Not documented | "Signed webhooks" |
| Idempotent ordering | **Not documented** | Not verified | Yes: `Idempotency-Key` header on `POST /orders` | Not documented | Not documented |
| Sandbox / test mode | **Not documented** (webhook `ping` only) | Sandbox exists per partner program (not verified) | Not documented | Paid pilot (≤50 numbers) | Not documented |
| Production access | Self-serve API key (per docs) | Partner application | Account + wallet top-up via Stripe | Application + business review + paid pilot | Request access + approval |
| Wholesale prices | Per-item prices in API; currency **not stated** | Not public | `wholesale_price` / `retail_price` in API | Credit-based: $0.10 to $0.12 per credit by monthly volume | Not public |
| Data retention terms | Not documented | Not verified | Not documented | Not documented | Not documented |
| Resale / verification-use terms | **Not found**, must be obtained in writing | Partner agreement | Not documented | White-label resale explicitly offered; third-party bans not covered | B2B partner terms (not public) |

## Decision

**Primary supplier: 1001SMS.**

Reasons:

1. It is the only candidate whose public documentation covers **all three** product lines
   (travel eSIMs, one-time SMS activations, long-term number rentals) behind **one** API key.
   This avoids duplicate credentials and a second integration.
2. Its endpoints, response fields, error codes and webhook signing scheme are documented in
   enough detail to implement a real adapter without guessing.
3. It exposes live inventory (`count`) and deliverability per operator, which lets the
   storefront hide out-of-stock offers instead of hardcoding availability.
4. Its signed webhooks (`sms.received`, `esim.allocated`, …) remove the need for aggressive polling.

Risks accepted and mitigated:

| Risk | Mitigation in this codebase |
|---|---|
| No idempotency key on orders | Durable fulfilment records written *before* the supplier call; lost responses become `UNCERTAIN` and are reconciled by listing supplier orders, never blindly retried (see ARCHITECTURE.md §Fulfilment). |
| Price currency undocumented | `SUPPLIER_PRICE_CURRENCY` config + blocker in INTEGRATION_STATUS.md. |
| No sandbox | Clearly-labelled sandbox adapter with fixtures; demo orders are flagged `isSandbox` everywhere. |
| Reseller/verification-use terms not public | Launch blocker, written confirmation required. |

**Not integrated:** Airalo, Simtasy, ESIMPY and Roamlinx. The provider abstraction
(`src/server/providers/supplier/types.ts`) allows a second eSIM supplier (Simtasy's documented
API with `Idempotency-Key` is the best fallback candidate) to be added later without changing
order or fulfilment code.
