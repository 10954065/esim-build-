import { describe, expect, it } from "vitest";
import { formatBytes, formatMoney, minorUnitExponent } from "./currency";

describe("minorUnitExponent", () => {
  it.each([
    ["USD", 2],
    ["ghs", 2],
    ["JPY", 0],
    ["XOF", 0],
    ["KWD", 3],
  ])("%s has %i decimals", (currency, exp) => {
    expect(minorUnitExponent(currency)).toBe(exp);
  });
});

describe("formatMoney", () => {
  it("uses the currency's own number of decimals", () => {
    expect(formatMoney("12.5", "USD")).toBe("$12.50");
    expect(formatMoney(1500, "JPY")).toBe("¥1,500");
    expect(formatMoney("1.2345", "KWD")).toMatch(/1\.235/);
  });

  it("falls back to a plain amount for an unknown currency code", () => {
    expect(formatMoney("3", "NOT-A-CODE")).toBe("3.00 NOT-A-CODE");
  });
});

describe("formatBytes", () => {
  it.each([
    [null, "Unknown"],
    [512 * 1024, "512 KB"],
    [300 * 1024 ** 2, "300 MB"],
    [1024 ** 3, "1 GB"],
    [BigInt(3 * 1024 ** 3 + 512 * 1024 ** 2), "3.5 GB"],
  ])("formats %s as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});
