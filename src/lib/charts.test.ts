import { describe, expect, it } from "vitest";
import { axisTickIndexes, daysInRange, profitBreakdown, scaleToMax } from "./charts";

describe("scaleToMax", () => {
  it("scales values against the largest one", () => {
    expect(scaleToMax([0, 5, 10])).toEqual([0, 50, 100]);
  });

  it("returns zeros when every value is zero or the list is empty", () => {
    expect(scaleToMax([0, 0])).toEqual([0, 0]);
    expect(scaleToMax([])).toEqual([]);
  });
});

describe("axisTickIndexes", () => {
  it("labels the first, middle and last point", () => {
    expect(axisTickIndexes(14)).toEqual([0, 6, 13]);
  });

  it("does not repeat an index on short series", () => {
    expect(axisTickIndexes(1)).toEqual([0]);
    expect(axisTickIndexes(2)).toEqual([0, 1]);
    expect(axisTickIndexes(0)).toEqual([]);
  });
});

describe("daysInRange", () => {
  it("counts whole days in a half open range, rounding partial days up", () => {
    expect(daysInRange(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-15T00:00:00Z"))).toBe(14);
    expect(daysInRange(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-01T06:00:00Z"))).toBe(1);
  });

  it("never returns a negative count", () => {
    expect(daysInRange(new Date("2026-10-02"), new Date("2026-10-01"))).toBe(0);
  });
});

describe("profitBreakdown", () => {
  const base = { grossSales: "100", refunds: "10", supplierCostConverted: "50", gatewayFees: "5", netContribution: "35" };

  it("splits gross sales into shares that add up to 100", () => {
    const parts = profitBreakdown(base);
    expect(parts?.map((p) => [p.key, p.share])).toEqual([
      ["refunds", 10],
      ["supplier", 50],
      ["fees", 5],
      ["contribution", 35],
    ]);
  });

  it("refuses to draw without sales, without exchange rates or with a loss", () => {
    expect(profitBreakdown({ ...base, grossSales: "0" })).toBeNull();
    expect(profitBreakdown({ ...base, supplierCostConverted: null, netContribution: null })).toBeNull();
    expect(profitBreakdown({ ...base, netContribution: "-3" })).toBeNull();
  });
});
