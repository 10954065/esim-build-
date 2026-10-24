/**
 * Payment gateway abstraction. Business logic depends only on this contract, so the
 * approved gateway can be replaced without touching orders or fulfilment.
 * All amounts are integer minor units (e.g. pesewas, cents) as the gateways expect.
 */

export type GatewayCode = "PAYSTACK" | "SANDBOX";
export type GatewayChargeStatus = "SUCCESS" | "FAILED" | "ABANDONED" | "PENDING" | "REVERSED";
export type GatewayRefundStatus = "PENDING" | "PROCESSED" | "FAILED";

export interface InitializeInput {
  reference: string;
  amountMinor: bigint;
  currency: string;
  email: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export interface VerifiedCharge {
  reference: string;
  status: GatewayChargeStatus;
  amountMinor: bigint;
  currency: string;
  gatewayTransactionId: string | null;
  channel: string | null;
  feeMinor: bigint | null;
  paidAt: Date | null;
  gatewayMessage: string | null;
}

export interface RefundInput {
  reference: string;
  gatewayTransactionId: string | null;
  amountMinor: bigint;
  currency: string;
  reason: string;
}

export interface GatewayRefund {
  gatewayRefundId: string;
  status: GatewayRefundStatus;
  amountMinor: bigint | null;
}

export type PaymentWebhookEvent =
  | { kind: "charge"; eventId: string; type: string; reference: string }
  | { kind: "refund"; eventId: string; type: string; gatewayRefundId: string | null; transactionReference: string | null; status: GatewayRefundStatus }
  | { kind: "ignored"; eventId: string; type: string };

export interface PaymentGateway {
  code: GatewayCode;
  isSandbox: boolean;
  initialize(input: InitializeInput): Promise<{ authorizationUrl: string }>;
  /** Server-side verification — the only source of truth for whether a charge succeeded. */
  verify(reference: string): Promise<VerifiedCharge>;
  refund(input: RefundInput): Promise<GatewayRefund>;
  getRefund(gatewayRefundId: string): Promise<GatewayRefund>;
  /** Refunds the gateway knows about for a charge (used to reconcile uncertain submissions). */
  listRefunds(reference: string): Promise<GatewayRefund[]>;
  /** Authenticate and parse a webhook. Throws PaymentWebhookError when invalid. */
  verifyWebhook(rawBody: string, headers: Headers): PaymentWebhookEvent;
}

export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    readonly opts: { retryable: boolean; uncertain: boolean; httpStatus?: number } = { retryable: false, uncertain: false },
  ) {
    super(message);
    this.name = "PaymentGatewayError";
  }
}

export class PaymentWebhookError extends Error {
  constructor(readonly reason: "missing_signature" | "bad_signature" | "stale_timestamp" | "invalid_payload" | "not_configured") {
    super(reason);
    this.name = "PaymentWebhookError";
  }
}
