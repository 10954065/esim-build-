/**
 * Normalized supplier errors. The fulfilment engine decides what to do based on
 * `kind`, `retryable` and `uncertain` — never on raw supplier messages.
 */

export type SupplierErrorKind =
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED" // bad key or missing scope
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "PRODUCT_UNAVAILABLE"
  | "RATE_LIMITED"
  | "PROVIDER_FAILED" // supplier reports upstream failure and refunded the charge
  | "UNAVAILABLE" // temporary outage
  | "UNCERTAIN" // request may or may not have been executed (timeout, network, 5xx)
  | "INVALID_RESPONSE";

const RETRYABLE: ReadonlySet<SupplierErrorKind> = new Set(["RATE_LIMITED", "PROVIDER_FAILED", "UNAVAILABLE"]);

export class SupplierError extends Error {
  readonly kind: SupplierErrorKind;
  readonly httpStatus: number | null;
  readonly retryable: boolean;
  /** True when a mutating request may have succeeded on the supplier side. */
  readonly uncertain: boolean;
  readonly details: Record<string, unknown>;

  constructor(
    kind: SupplierErrorKind,
    message: string,
    opts: { httpStatus?: number | null; details?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = "SupplierError";
    this.kind = kind;
    this.httpStatus = opts.httpStatus ?? null;
    this.retryable = RETRYABLE.has(kind);
    this.uncertain = kind === "UNCERTAIN";
    this.details = opts.details ?? {};
  }

  /** Message safe for staff dashboards (no secrets, no raw payloads). */
  toSafeString(): string {
    return `${this.kind}${this.httpStatus ? ` (HTTP ${this.httpStatus})` : ""}: ${this.message}`.slice(0, 500);
  }
}

export class SupplierWebhookError extends Error {
  readonly reason: "missing_signature" | "bad_signature" | "stale_timestamp" | "invalid_payload" | "not_configured";
  constructor(reason: SupplierWebhookError["reason"], message?: string) {
    super(message ?? reason);
    this.name = "SupplierWebhookError";
    this.reason = reason;
  }
}

export function isSupplierError(err: unknown): err is SupplierError {
  return err instanceof SupplierError;
}
