# Security

This document describes the controls that exist in the code today, how they were verified,
and the known gaps. If a control is listed here, it is implemented and has a test or a
recorded manual check, which is noted next to it.

## Threat model (summary)

| Asset | Main threats | Primary controls |
|---|---|---|
| Customer money | Forged payment confirmations, amount tampering, double fulfilment, refund abuse | Server-side gateway verification, exact amount/currency match, idempotent state machine, ledger |
| Supplier balance | Duplicate supplier orders, replayed webhooks, enumeration of purchase endpoints | Claim-before-call fulfilment, reconciliation (no blind retry), webhook HMAC + dedupe, rate limits |
| eSIM activation codes, SMS codes, numbers | Cross-account access (IDOR), database leak, log leak | Owner-scoped queries, AES-256-GCM at rest, log redaction, retention job |
| Staff console | Privilege escalation, account takeover | Server-side RBAC per page and action, mandatory TOTP for staff in production, audit log |

## Authentication (Better Auth 1.7)

- Email + password with **mandatory email verification** (`requireEmailVerification`).
  Passwords 10–128 characters, hashed by Better Auth.
- Password reset tokens expire after 1 hour, and a reset **revokes all sessions**.
- Sessions: httpOnly cookies, `Secure` whenever the app URL is https, 14-day lifetime refreshed
  daily. `trustedOrigins` is limited to `APP_URL`; cross-origin auth requests get 403 (manually verified).
- TOTP two-factor with lockout columns (`failedVerificationCount`, `lockedUntil`).
  **Staff must enable 2FA in production**: `requireStaff` redirects staff without 2FA to the security page.
- Registration does not reveal whether an email exists. Terms acceptance is recorded with its timestamp.
- Suspended (banned) users are signed out everywhere and cannot sign in.

## Authorization

- `src/proxy.ts` is only an optimistic redirect for guests. **Every** page and server action
  re-checks the session itself (`requireUser`, `requireStaff`, `assertPermission`).
- Roles: `user`, `support`, `finance`, `admin`. The permission matrix is in
  `src/server/auth/permissions.ts` and has unit tests (support cannot refund, finance cannot manage users, and so on).
- Customer reads always filter by `userId`. Another customer's order, eSIM or verification session
  returns **404**, not 403, so ids cannot be probed. This is covered by an integration test and an E2E test.
- Customers who request `/admin` get 404 (E2E test).
- Role changes can only be made by admins or from the trusted CLI (`pnpm admin:grant`), and every change is audit-logged.

## Payments

- The client never decides whether an order is paid. Payment state changes only through
  `confirmPayment`, which calls the gateway's **server-side verify** endpoint and requires an
  exact amount and currency match. A mismatch moves the order to `NEEDS_REVIEW` and nothing is fulfilled (integration test).
- Paystack webhooks: HMAC-SHA512 over the raw body, compared in constant time. Forged webhooks
  are rejected (integration test).
- Webhook deliveries are de-duplicated by `WebhookEvent` (provider + event id). Replays have no effect (integration test).
- Checkout carries an idempotency key, so a double-submitted form creates one order and one payment (integration test).
- Refunds go `REQUESTED → PENDING → COMPLETED` and reach `COMPLETED` only after the gateway confirms.
  The total refunded can never exceed the captured amount.
- The ledger is append-only and double-entry. A Postgres trigger blocks `UPDATE`/`DELETE` on ledger rows.

## Supplier integration

- 1001SMS webhooks: HMAC-SHA256 over `t.rawBody`, 5-minute timestamp tolerance, constant-time
  compare (unit-tested against the documented algorithm).
- Fulfilment claims the order item *before* calling the supplier. Timeouts and unknown outcomes become
  `UNCERTAIN` and are reconciled against the supplier's order list; they are never blindly retried.
  This prevents double purchases, because the supplier offers no idempotency keys.
- Supplier API keys exist only on the server. Nothing uses the `NEXT_PUBLIC_` prefix.

## Data protection

- eSIM LPA strings, QR URLs and SMS contents are encrypted with **AES-256-GCM**
  (`DATA_ENCRYPTION_KEY`, random IV per value, authenticated, stored as `v1.<iv>.<tag>.<ct>`).
  Unit-tested, including tamper detection.
- Activation codes are hidden by default in the UI and only decrypted for the owner's own page.
- The logger recursively redacts keys that look like secrets, tokens, passwords, codes or
  authorization headers. Webhook payloads are stored only after redaction.
- Retention (`src/lib/retention.ts`, enforced daily by `maintenance.retention`):
  SMS content 30 days · numbers anonymised after 365 days · abandoned orders 30 days ·
  webhook payloads 90 days · audit logs 2 years · financial records 7 years. The privacy page renders these same values.

## Web platform

- Security headers on every response (`next.config.ts`): CSP (`default-src 'self'`,
  `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self' https://checkout.paystack.com`),
  HSTS (2 years, preload) in production, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and no `X-Powered-By`.
- Server actions are protected by Next.js's origin check. Better Auth checks origins on its own routes.
- The single `dangerouslySetInnerHTML` (FAQ JSON-LD) serialises static content and escapes `<`.
- Post-login redirects only allow same-origin relative paths (`src/lib/safe-redirect.ts`).
- `/api/health` reports only `ok` or `degraded`, never versions, balances or errors.
- `/api/cron/jobs` requires `Authorization: Bearer $CRON_SECRET` with a constant-time compare.
  A missing secret is accepted **only** when `APP_ENV` is `development` or `test`, and env validation
  makes the secret mandatory in production.
- `/dev/mailbox` returns 404 unless `APP_ENV` is development/test **and** the email provider is `log`.

## Rate limits

| Endpoint | Limit |
|---|---|
| Sign in | 5 / minute |
| Sign up (Better Auth) | 10 / hour |
| Registration action | 10 / hour per IP, 3 / hour per email |
| Password reset / verification email | 5 / hour |
| TOTP / backup-code verify | 5 / minute |
| Checkout | 10 / 10 minutes per user |
| Verification refresh / cancel | 12 / minute · 10 / hour per user |
| Support tickets / replies | 5 / hour · 30 / hour per user |
| Other auth routes | 100 / minute |

All limits are stored in Postgres, so they hold across serverless instances. Sign-in returning 429 after 5 attempts was verified manually.

## Environment guards (`src/server/env.ts`)

When `APP_ENV=production` the process refuses to start if any of the following holds:
sandbox supplier, sandbox payments, the `log` email provider, no `CRON_SECRET`, or a
non-https `APP_URL`. The sandbox gateway also cannot be paired with a live supplier in any environment. All of this is unit-tested.

## Dependency status

`pnpm audit --prod` reports **no known vulnerabilities** (2026-10-24). The `shadcn` CLI was
moved to devDependencies; its transitive `body-parser` advisory affects only the build-time CLI.

## Known gaps and accepted risks

1. **CSP allows `'unsafe-inline'` scripts.** The Next.js App Router emits inline bootstrap
   scripts. Moving to nonce-based CSP means generating a nonce per request in `proxy.ts`, and every page then renders dynamically.
   Accepted for launch: there is no user-supplied HTML anywhere.
2. **No WAF or bot protection** beyond rate limits. Turn on Vercel Firewall / BotID in front of checkout and sign-up before marketing spend.
3. **Paystack webhook verification** was implemented from third-party descriptions, because the official docs
   returned 403 to automated fetches. Re-check it against official documentation and a real test-mode delivery before go-live.
4. **1001SMS adapter** has not been called against the live API (no key). See `INTEGRATION_STATUS.md`.
5. **Key rotation** for `DATA_ENCRYPTION_KEY` needs a re-encryption script. The `v1.` prefix leaves room for a second key version; the script is not yet built.
6. Account deletion requests are recorded for manual handling, not executed automatically
   (financial records must be kept for 7 years).

## Reporting a vulnerability

Email the address in `SUPPORT_EMAIL` with the subject "Security". Do not open a public issue.
