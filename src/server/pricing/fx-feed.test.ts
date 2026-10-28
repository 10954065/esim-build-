import { describe, expect, it } from "vitest";
import { isPlausibleChange, parseFeed } from "./fx-feed";

const feed = (overrides: Record<string, unknown> = {}) => ({
  result: "success",
  base_code: "USD",
  time_last_update_unix: 1793145751,
  rates: { USD: 1, GHS: 11.643541, EUR: 0.86 },
  ...overrides,
});

describe("parseFeed", () => {
  it("reads the quote rate and the provider's publish time", () => {
    expect(parseFeed(feed(), "USD", "GHS")).toEqual({ rate: "11.643541", publishedAt: new Date(1793145751 * 1000) });
  });

  it("rejects a failed response", () => {
    expect(() => parseFeed(feed({ result: "error", "error-type": "unsupported-code" }), "USD", "GHS")).toThrow(/unsupported-code/);
  });

  it("rejects a feed for a different base currency", () => {
    expect(() => parseFeed(feed({ base_code: "EUR" }), "USD", "GHS")).toThrow(/base EUR/);
  });

  it("rejects a missing, zero or negative rate", () => {
    expect(() => parseFeed(feed({ rates: { USD: 1 } }), "USD", "GHS")).toThrow(/no GHS rate/);
    expect(() => parseFeed(feed({ rates: { GHS: 0 } }), "USD", "GHS")).toThrow();
    expect(() => parseFeed(feed({ rates: { GHS: -2 } }), "USD", "GHS")).toThrow();
  });

  it("rejects a malformed body", () => {
    expect(() => parseFeed("<html>", "USD", "GHS")).toThrow();
  });
});

describe("isPlausibleChange", () => {
  it("accepts any first rate", () => {
    expect(isPlausibleChange("11.64", null)).toBe(true);
  });

  it("accepts moves within the limit in either direction", () => {
    expect(isPlausibleChange("13.00", "11.64")).toBe(true);
    expect(isPlausibleChange("10.00", "11.64")).toBe(true);
  });

  it("rejects moves beyond the limit", () => {
    expect(isPlausibleChange("14.50", "11.64")).toBe(false);
    expect(isPlausibleChange("1.164", "11.64")).toBe(false);
  });
});
