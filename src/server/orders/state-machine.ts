/**
 * Order state machine. Pure, the single source of truth for which order status changes
 * are legal. All writes go through transitionOrder() in ./service.ts, which records every
 * change in OrderStatusHistory with actor, reason and timestamp.
 */

export const ORDER_STATUSES = [
  "CREATED",
  "AWAITING_PAYMENT",
  "PAID",
  "FULFILLING",
  "FULFILLED",
  "NEEDS_REVIEW",
  "FAILED",
  "REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "CANCELLED",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatusValue, readonly OrderStatusValue[]> = {
  CREATED: ["AWAITING_PAYMENT", "CANCELLED"],
  // NEEDS_REVIEW: payment captured but amount/currency did not match the order.
  AWAITING_PAYMENT: ["PAID", "CANCELLED", "NEEDS_REVIEW"],
  PAID: ["FULFILLING", "NEEDS_REVIEW", "FAILED", "REFUND_PENDING"],
  FULFILLING: ["FULFILLED", "NEEDS_REVIEW", "FAILED"],
  // FULFILLED from review is only reachable with a verified supplier reference (audited).
  NEEDS_REVIEW: ["FULFILLING", "FULFILLED", "FAILED", "REFUND_PENDING"],
  FAILED: ["REFUND_PENDING", "FULFILLING"],
  // e.g. a verification session that expired without an SMS after being fulfilled.
  FULFILLED: ["REFUND_PENDING"],
  REFUND_PENDING: ["REFUNDED", "PARTIALLY_REFUNDED", "NEEDS_REVIEW"],
  PARTIALLY_REFUNDED: ["REFUND_PENDING", "REFUNDED"],
  REFUNDED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: OrderStatusValue): readonly OrderStatusValue[] {
  return TRANSITIONS[from];
}

export function isTerminal(status: OrderStatusValue): boolean {
  return TRANSITIONS[status].length === 0;
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: OrderStatusValue,
    readonly to: OrderStatusValue,
  ) {
    super(`Invalid order transition ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: OrderStatusValue, to: OrderStatusValue): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** Statuses in which the customer has paid and money may need to be returned. */
export function isPaidStatus(status: OrderStatusValue): boolean {
  return ["PAID", "FULFILLING", "FULFILLED", "NEEDS_REVIEW", "FAILED", "REFUND_PENDING", "PARTIALLY_REFUNDED"].includes(status);
}
