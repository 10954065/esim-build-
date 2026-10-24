/**
 * Data retention rules. The privacy policy renders these values and the maintenance job
 * enforces them, so the published policy always matches the implementation.
 */
export const RETENTION = {
  /** SMS message bodies and codes are deleted this many days after receipt. */
  smsContentDays: 30,
  /** Verification/rental phone numbers are anonymised this many days after the session ends. */
  phoneNumberDays: 365,
  /** Unpaid, abandoned orders are deleted after this many days. */
  abandonedOrderDays: 30,
  /** Development email previews are removed after this many days. */
  emailPreviewDays: 7,
  /** Webhook payloads (already redacted) are deleted after this many days. */
  webhookPayloadDays: 90,
  /** Audit logs are kept for this many years. */
  auditLogYears: 2,
  /** Payment, refund and ledger records are kept for this many years (accounting obligations). */
  financialRecordYears: 7,
} as const;
