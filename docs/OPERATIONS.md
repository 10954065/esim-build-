# Operations Runbook

For whoever runs the live marketplace day to day: support, finance and on-call engineers.
Every console path below is under `/admin` and needs the stated permission.

## Daily checks (5 minutes)

1. **`/admin`** overview: orders needing review, failed fulfilments, pending refunds, open tickets.
2. **`/admin/integrations`**: dead jobs, webhook failures in the last 24 h, emails not delivered.
3. **`/admin/suppliers`**: supplier balance. The `supplier.balance` job records it every 30 minutes.
   Top up before the balance drops below a day of sales. When the balance runs out, purchases fail and are refunded automatically, which costs gateway fees.
4. **`/admin/refunds`**: anything `PENDING` for more than 24 h. Paystack refunds can take days to settle,
   but anything older should be checked in the Paystack dashboard.

## Background jobs

Jobs are stored in the `Job` table. Vercel Cron calls `GET /api/cron/jobs` every minute; each call
enqueues the recurring work below (de-duplicated per interval) and then drains due jobs for up to 50 seconds.
Customer pages also process due jobs after responding (`kickJobs`), so fulfilment usually starts within seconds.

| Job | Interval | Purpose |
|---|---|---|
| `verification.sweep` | 1 min | Poll SMS for active verification numbers; expire finished sessions |
| `esim.sweep` | 2 min | Refresh eSIM status/usage from the supplier |
| `orders.expire-unpaid` | 5 min | Cancel orders left unpaid past the payment window |
| `refund.sweep` | 5 min | Re-check `PENDING` refunds with the gateway |
| `rental.sweep` | 15 min | Expire rentals, fetch new messages |
| `supplier.balance` | 30 min | Record supplier balance |
| `catalog.sync` | 60 min | Refresh countries, packages, services and prices |
| `maintenance.retention` | daily | Enforce `src/lib/retention.ts` |

Event-driven jobs: `fulfil-order-item`, `reconcile-fulfilment`, `refund.submit`, `refund.reconcile`.

**Retries:** exponential backoff with jitter, up to 8 attempts, then `DEAD`. A job stuck in
`RUNNING` for more than 10 minutes (a crashed worker) is picked up again automatically.
**Dead jobs:** inspect `lastError` on `/admin/integrations`, fix the cause, then press *Retry*.

## Order states and what to do

| State | Meaning | Action |
|---|---|---|
| `CREATED` / `AWAITING_PAYMENT` | Customer has not paid | None. Expires automatically after the payment window, but only after the gateway has been asked once more |
| `PAID` / `FULFILLING` | Being bought from the supplier | None, unless it stays here more than 15 min (check jobs) |
| `FULFILLED` (shown as "Completed") | Delivered | None |
| `NEEDS_REVIEW` | Paid, but the outcome is unclear or needs a decision | **Act within 1 business day** (see below) |
| `REFUND_PENDING` | Refund submitted, waiting for gateway confirmation | None unless older than 24 h |
| `REFUNDED` / `PARTIALLY_REFUNDED` | Refund confirmed by the gateway | None |
| `CANCELLED` / `FAILED` | Not paid, or failed before payment | None. A late payment on a cancelled order is refunded automatically |

### Resolving `NEEDS_REVIEW` (`/admin/orders/[id]`, permission `orders.manual_fulfil` / `refunds.manage`)

The order page shows the supplier error and the fulfilment history. Typical causes:

- **Amount or currency mismatch** between the gateway and the order. Check the payment in the gateway
  dashboard. If the customer underpaid, refund in full. **Never** fulfil an underpaid order.
- **Supplier outcome uncertain** (timeout during purchase). First press **Retry fulfilment**: it
  reconciles against the supplier's order list before buying anything new. If the supplier dashboard
  shows an order this system missed, use **Link supplier order**. The system fetches that order from
  the supplier and attaches it only if it is the purchased product (eSIM package, verification service
  and country, or rental term) and is not already linked to another order. There is deliberately no "mark as fulfilled" button.
- **Supplier rejected the order** (out of stock, operator error): issue a full refund.

## Refunds

- Customers cannot request money directly. Support opens a refund from the order page (permission `refunds.manage`: finance and admin).
- Automatic refunds happen when a purchase definitely failed, when a verification number receives no SMS
  and is cancelled (the supplier must confirm the cancellation first), and when a payment arrives on a cancelled order.
- A refund is `COMPLETED` only after the gateway confirms it. If a submission timed out, `refund.reconcile`
  checks the gateway's refund list before trying again, so customers are never refunded twice.

## Support tickets (`/admin/support`, permission `support.manage`)

- Reply from the ticket page. The customer gets an email and sees the reply in their dashboard.
- **Never** paste an activation code or SMS code into a ticket. Point customers to their eSIM page instead.
- Staff do not see decrypted activation codes in the console. Re-sending an eSIM means asking the customer to open their own dashboard.

## Users (`/admin/users`, permission `users.manage`: admin only)

- **Suspend** signs the user out everywhere and blocks sign-in. Use it for fraud or abuse.
- **Grant a staff role** from the user page or the CLI: `pnpm admin:grant person@example.com support`.
  The person must have registered and verified their email first. In production, staff must enable 2FA before the console opens.
- Every role change, suspension, refund, manual link and pricing change is recorded in `/admin/audit-logs`.

## Pricing (`/admin/pricing`, permission `pricing.manage`)

- Margin rules apply by category, country or product, and the most specific rule wins. Prices are rounded per currency.
- Exchange rates are **entered by staff, with a source**. Nothing fetches rates automatically.
  Update them whenever the supplier currency and the payment currency differ and the rate moves more than about 1%.
- Customer prices are recalculated at checkout from the live supplier cost, so a stale catalogue cannot sell below cost.

## Incident playbooks

**Supplier API down** (`catalog.sync`/`esim.sweep` failing, purchases timing out)
1. In `/admin/settings`, switch off **Accept new purchases**. Browsing keeps working from the catalogue cache.
   To stop selling a single country or service instead, hide it in `/admin/countries` or `/admin/services`.
2. Paid orders stay queued or become `UNCERTAIN`, and are reconciled once the API recovers. Do **not** refund them by hand while they are uncertain, or customers may get both the product and a refund.

**Payment webhooks not arriving**
- Customers returning from checkout are verified server-side on the return page, so most orders still complete.
- `orders.expire-unpaid` verifies with the gateway before cancelling, so a missed webhook does not cancel a paid order.
- Check the webhook URL in the Paystack dashboard: `https://<domain>/api/webhooks/payments/paystack`.

**Database unavailable**: `/api/health` returns 503. Point uptime monitoring at it. Restore
from the provider's point-in-time backup; the ledger and jobs are transactional, so nothing needs replaying by hand.

**Suspected key leak**
- `PAYSTACK_SECRET_KEY` / `SMS1001_API_KEY`: rotate in the provider dashboard, update the env var, redeploy.
- `BETTER_AUTH_SECRET`: rotating it signs everyone out.
- `DATA_ENCRYPTION_KEY`: **do not** simply replace it, or existing ciphertext becomes unreadable. Follow
  SECURITY.md, "Rotating the data encryption key": set the new key, keep the old one in
  `DATA_ENCRYPTION_KEYS_PREVIOUS`, run `pnpm data:reencrypt` until it reports nothing left, then remove the old key.

## Monitoring to set up

- Uptime check on `/api/health` (1 min).
- Alerts on log lines with `"level":"error"` (Vercel log drains to your tool of choice).
- A weekly look at `/admin/analytics` (profit report). It shows **net contribution**
  (sales − refunds − supplier cost − gateway fees), not net profit: hosting, staff and tax are not included.
