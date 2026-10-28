# Deployment

The reference target is **Vercel** (Next.js 16, Fluid Compute) with a managed **PostgreSQL**
database. Any Node 24 host works if it can run `next start` and call a URL every minute.

## 1. Prerequisites

| Need | Why | Notes |
|---|---|---|
| PostgreSQL 15+ | All data, job queue, rate limits | Neon / Supabase / RDS. Use a **pooled** URL for the app |
| Vercel **Pro** (or another scheduler) | `/api/cron/jobs` must run every minute | Hobby crons run at most once a day, which is too slow for fulfilment and SMS polling (see §6) |
| 1001SMS account + API key | Supplier | Scopes `read`, `activate`, `numbers`, `esim` |
| Paystack merchant account | Payments | **Category eligibility must be approved first**. See INTEGRATION_STATUS.md |
| Resend account + verified domain | Transactional email | SPF/DKIM records on your domain |
| Your domain | HTTPS, email sender, webhooks | |

## 2. Environment variables

Set these in Vercel → Project → Settings → Environment Variables, per environment.
`.env.example` documents every variable. The app **refuses to start in production** if a guard fails (`src/server/env.ts`).

| Variable | Production value |
|---|---|
| `APP_ENV` | `production` (`staging` for previews; `staging` still requires `CRON_SECRET`) |
| `APP_URL`, `BETTER_AUTH_URL` | `https://your-domain` (must be https) |
| `APP_NAME`, `SUPPORT_EMAIL` | Your brand and support inbox |
| `DATABASE_URL` | Pooled connection string. Supabase: see "Supabase" in §3 |
| `DATABASE_POOL_MAX` | `5` on serverless (connections are per instance) |
| `DATABASE_SSL_CA` | PEM contents of your database's CA certificate when it is not publicly trusted (Supabase) |
| `BETTER_AUTH_SECRET` | 32 random bytes, base64url |
| `DATA_ENCRYPTION_KEY` | 32 random bytes, base64. **Back it up offline**: losing it makes activation codes and SMS unreadable |
| `DATA_ENCRYPTION_KEYS_PREVIOUS` | Empty, except during a key rotation (SECURITY.md, "Rotating the data encryption key") |
| `SUPPLIER_MODE` | `live` |
| `SMS1001_API_KEY`, `SMS1001_WEBHOOK_SECRET` | From 1001SMS (secret comes from step 5) |
| `SUPPLIER_PRICE_CURRENCY` | Currency 1001SMS quotes in (**confirm with them**) |
| `PAYMENT_PROVIDER` | `paystack` |
| `PAYSTACK_SECRET_KEY` | Live secret key (`sk_live_…`) |
| `PAYMENT_CURRENCY` | A currency enabled on your Paystack account (e.g. `GHS`) |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | `resend`, key, `Brand <no-reply@your-domain>` |
| `CRON_SECRET` | 32 random bytes. Vercel sends it as `Authorization: Bearer …` |
| `GOOGLE_CLIENT_ID/SECRET` | Optional |

Leave `SANDBOX_SIGNING_SECRET` unset in production; sandbox mode is rejected there anyway.

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"  # auth / cron
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"     # DATA_ENCRYPTION_KEY
```

## 3. Database migrations

Migrations are **not** run during `next build`, so a failed migration never ships half-applied.
Run them from CI or a trusted machine **before** promoting a deployment, using a direct (non-pooled) URL:

```bash
DATABASE_URL="postgresql://…direct…" pnpm db:deploy
```

The initial migration installs the trigger that keeps the ledger append-only. Check it after the first deploy:

```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'LedgerEntry_no_update';
```

Do **not** run `pnpm db:seed` against production. It refuses when `APP_ENV=production` and only creates demo data.

### Supabase

Supabase is plain PostgreSQL to the app; only the connection strings and TLS need care.
Take both strings from **Connect** at the top of the project dashboard.

| Use | String | Port |
|---|---|---|
| App (`DATABASE_URL`) | **Transaction pooler** | 6543 |
| Migrations (inline `DATABASE_URL` for `pnpm db:deploy`) | **Session pooler**, with `?sslmode=require` | 5432 |

The direct `db.<ref>.supabase.co` host is IPv6 only unless you buy the IPv4 add-on, so use the session pooler for migrations.
The app uses no session features (advisory locks, LISTEN), so the transaction pooler is safe.

**TLS.** Supabase signs its certificates with its own root CA, so Node cannot verify them by default.
Download the certificate from **Database Settings → SSL Configuration**, paste its contents into
`DATABASE_SSL_CA`, and leave `sslmode` off `DATABASE_URL`: the app then verifies the server against that CA.
(The `pg` driver treats `sslmode=require` as `verify-full`, which fails against Supabase without the CA.)
Then switch on **Enforce SSL on incoming connections** in the same settings section.

```bash
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require" pnpm db:deploy
```

**Data API.** Supabase also serves the `public` schema over HTTP to anyone holding the project's anon key.
The `enable_row_level_security` migration turns on RLS with no policies on every table, which denies those
requests; the app connects as the table owner and is unaffected. Also turn the Data API off
(**Project Settings → Data API**), because this app never uses it, and do not put the anon or service role key in the app.
After adding tables in a later migration, enable RLS on them too:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;  -- must return no rows
```

## 4. Deploy

```bash
# first time
vercel link
vercel env pull .env.production.local   # optional, to inspect
vercel deploy --prod
```

Or connect the GitHub repository in the Vercel dashboard; every push to `main` deploys.
Build command: `pnpm build` (runs `prisma generate && next build`). Install: `pnpm install`.
`vercel.json` registers the cron (`* * * * *` → `/api/cron/jobs`).

## 5. After the first deploy

1. **Health:** `curl https://your-domain/api/health` → `{"status":"ok"}`.
2. **Cron:** `curl -i https://your-domain/api/cron/jobs` → `401`. Then check Vercel → Cron Jobs shows successful runs.
3. **First admin:** register through the site, verify the email, then from a trusted machine:
   `DATABASE_URL=… pnpm admin:grant you@your-domain admin`. Sign in and enable 2FA (required for staff in production).
4. **Supplier webhooks:** register the endpoint with 1001SMS (`PUT /webhooks/config`):
   - url `https://your-domain/api/webhooks/supplier/1001sms`
   - events `sms.received, esim.allocated, esim.updated, esim.failed, esim.refunded, number.expired, number.cancelled, number.expiring`

   Put the returned `secret` in `SMS1001_WEBHOOK_SECRET` and redeploy.
5. **Payment webhooks:** in the Paystack dashboard set the webhook URL to
   `https://your-domain/api/webhooks/payments/paystack`. The callback URL is sent per transaction by the app (`/checkout/return?reference=…`).
6. **Catalogue:** `/admin/suppliers` → *Sync catalogue & balance now*. After that, `catalog.sync` runs hourly.
7. **Pricing:** create margin rules in `/admin/pricing`, in `PAYMENT_CURRENCY`. Production has no seeded rules,
   and a product with no active matching rule cannot be priced or sold (`NO_RULE`). Add an exchange rate if `SUPPLIER_PRICE_CURRENCY` ≠ `PAYMENT_CURRENCY`.
8. **Smoke test with real money:** buy the cheapest eSIM and a verification number with a real card, then refund one of them from
   `/admin/orders/[id]`. Confirm that the ledger entries, emails and the refund status all reach their final state.

## 6. Without Vercel Pro

Keep the endpoint and call it from any scheduler every minute, for example GitHub Actions (5-minute minimum), cron-job.org, or a small VM:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/jobs
```

Customer pages also process due jobs after each response, but that is a speed-up, not a replacement for the scheduler.

## 7. Staging / previews

- Use a **separate database** and `APP_ENV=staging`.
- For a fully simulated stack, set `SUPPLIER_MODE=sandbox`, `PAYMENT_PROVIDER=sandbox`,
  `SANDBOX_SIGNING_SECRET=…` and `EMAIL_PROVIDER=resend`. Everything is labelled DEMO and nothing costs money.
- `/dev/mailbox` is only available when `APP_ENV` is development/test.

## 8. Rollback

- App: Vercel → Deployments → *Promote* the previous deployment (instant).
- Database: migrations are forward-only. Write a new migration to reverse a change; use point-in-time
  restore only for data loss. Before rolling back across a migration, check that the older code still
  works with the newer schema (additive migrations are safe; renamed or dropped columns are not).

## 9. Local production build

```bash
docker compose up -d          # Postgres on :55433
cp .env.example .env          # fill the secrets
pnpm install && pnpm db:migrate && pnpm db:seed
pnpm build && pnpm start
```
