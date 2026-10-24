import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatRelative, formatTerm, formatValidity, maskPhone } from "./format";

describe("date formatting", () => {
  it("shows a dash for missing dates", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

  it("formats Date objects and ISO strings the same way", () => {
    const iso = "2026-10-24T10:00:00.000Z";
    expect(formatDateTime(iso)).toBe(formatDateTime(new Date(iso)));
    expect(formatDate(iso)).toMatch(/2026/);
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-10-24T12:00:00.000Z");

  it.each([
    [new Date("2026-10-24T11:59:30.000Z"), "30 seconds ago"],
    [new Date("2026-10-24T11:55:00.000Z"), "5 minutes ago"],
    [new Date("2026-10-24T15:00:00.000Z"), "in 3 hours"],
    [new Date("2026-10-22T12:00:00.000Z"), "2 days ago"],
  ])("formats %s relative to now", (date, expected) => {
    expect(formatRelative(date, now)).toBe(expected);
  });

  it("says never for a missing date", () => {
    expect(formatRelative(null, now)).toBe("never");
  });
});

describe("formatTerm and formatValidity", () => {
  it.each([
    ["1h", "1 hour"],
    ["4h", "4 hours"],
    ["1d", "1 day"],
    ["7d", "7 days"],
    ["180d", "6 months"],
    ["365d", "1 year"],
    ["weekly", "weekly"],
    [null, "—"],
  ])("formats term %s as %s", (term, expected) => {
    expect(formatTerm(term)).toBe(expected);
  });

  it("formats validity in days", () => {
    expect(formatValidity(1)).toBe("1 day");
    expect(formatValidity(30)).toBe("30 days");
    expect(formatValidity(null)).toBe("—");
  });
});

describe("maskPhone", () => {
  it("hides the middle digits but keeps the prefix and last three", () => {
    expect(maskPhone("+447700900123")).toBe("+44770•••123");
  });

  it("leaves very short values unchanged", () => {
    expect(maskPhone("12345")).toBe("12345");
  });
});
