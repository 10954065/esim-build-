import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, isPaidStatus, isTerminal, ORDER_STATUSES } from "./state-machine";

describe("order state machine", () => {
  it("allows the happy path", () => {
    const path = ["CREATED", "AWAITING_PAYMENT", "PAID", "FULFILLING", "FULFILLED"] as const;
    for (let i = 1; i < path.length; i++) expect(canTransition(path[i - 1]!, path[i]!)).toBe(true);
  });

  it("allows the failure and refund path", () => {
    expect(canTransition("FULFILLING", "FAILED")).toBe(true);
    expect(canTransition("FAILED", "REFUND_PENDING")).toBe(true);
    expect(canTransition("REFUND_PENDING", "REFUNDED")).toBe(true);
    expect(canTransition("REFUND_PENDING", "PARTIALLY_REFUNDED")).toBe(true);
  });

  it("never fulfils an unpaid order", () => {
    expect(canTransition("AWAITING_PAYMENT", "FULFILLING")).toBe(false);
    expect(canTransition("AWAITING_PAYMENT", "FULFILLED")).toBe(false);
    expect(canTransition("CREATED", "PAID")).toBe(false);
  });

  it("never marks a refund complete without going through REFUND_PENDING", () => {
    for (const s of ORDER_STATUSES) {
      if (s !== "REFUND_PENDING" && s !== "PARTIALLY_REFUNDED" && s !== "REFUNDED") expect(canTransition(s, "REFUNDED")).toBe(false);
    }
  });

  it("treats REFUNDED and CANCELLED as terminal", () => {
    expect(isTerminal("REFUNDED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(canTransition("CANCELLED", "PAID")).toBe(false);
    expect(() => assertTransition("REFUNDED", "FULFILLING")).toThrow(/Invalid order transition/);
  });

  it("allows idempotent same-status transitions", () => {
    expect(canTransition("PAID", "PAID")).toBe(true);
  });

  it("classifies paid statuses", () => {
    expect(isPaidStatus("FULFILLED")).toBe(true);
    expect(isPaidStatus("AWAITING_PAYMENT")).toBe(false);
    expect(isPaidStatus("CANCELLED")).toBe(false);
  });
});
