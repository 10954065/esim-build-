import { describe, expect, it } from "vitest";
import { fromMinorUnits, roundDownToMinor, roundUpToMinor, sum, toDbAmount, toMinorUnits } from "./money";

describe("money helpers", () => {
  it("rounds up and down to currency minor units", () => {
    expect(roundUpToMinor("1.231", "USD").toString()).toBe("1.24");
    expect(roundDownToMinor("1.239", "USD").toString()).toBe("1.23");
    expect(roundUpToMinor("100.1", "JPY").toString()).toBe("101");
    expect(roundUpToMinor("1.2341", "KWD").toString()).toBe("1.235");
  });

  it("converts to and from minor units exactly", () => {
    expect(toMinorUnits("12.34", "USD")).toBe(BigInt(1234));
    expect(toMinorUnits("150", "GHS")).toBe(BigInt(15000));
    expect(fromMinorUnits(BigInt(1234), "USD").toString()).toBe("12.34");
  });

  it("rejects amounts with more precision than the currency allows", () => {
    expect(() => toMinorUnits("1.234", "USD")).toThrow();
  });

  it("formats database amounts at 4 decimal places and sums without float drift", () => {
    expect(toDbAmount("1.5")).toBe("1.5000");
    expect(sum(["0.1", "0.2"]).toString()).toBe("0.3");
  });
});
