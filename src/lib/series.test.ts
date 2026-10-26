import { describe, expect, it } from "vitest";
import { fillDailySeries } from "./series";

describe("fillDailySeries", () => {
  it("returns one point per day, oldest first, with missing days as zero", () => {
    const end = new Date("2026-10-25T15:00:00Z");
    const series = fillDailySeries(
      [
        { day: "2026-10-23", orders: 2, sales: "10.50" },
        { day: "2026-10-25", orders: 1, sales: "4.05" },
      ],
      end,
      4,
    );
    expect(series).toEqual([
      { day: "2026-10-22", orders: 0, sales: 0 },
      { day: "2026-10-23", orders: 2, sales: 10.5 },
      { day: "2026-10-24", orders: 0, sales: 0 },
      { day: "2026-10-25", orders: 1, sales: 4.05 },
    ]);
  });

  it("ignores rows outside the window", () => {
    const series = fillDailySeries([{ day: "2026-01-01", orders: 9, sales: "99" }], new Date("2026-10-25T00:00:00Z"), 2);
    expect(series.map((p) => p.orders)).toEqual([0, 0]);
  });
});
