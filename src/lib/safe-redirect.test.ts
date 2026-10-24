import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it.each([
    ["/dashboard/orders", "/dashboard/orders"],
    ["/checkout?product=abc&qty=1", "/checkout?product=abc&qty=1"],
    ["/dashboard/../admin", "/admin"],
  ])("keeps the same-origin path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it("drops the fragment", () => {
    expect(safeNextPath("/help#refunds")).toBe("/help");
  });

  it.each([
    ["absolute URL", "https://evil.example/phish"],
    ["protocol-relative URL", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["javascript scheme", "javascript:alert(1)"],
    ["relative path", "dashboard"],
    ["header injection", "/ok\r\nSet-Cookie: x=1"],
    ["empty", ""],
  ])("falls back on a %s", (_label, input) => {
    expect(safeNextPath(input)).toBe("/dashboard");
  });

  it("uses the supplied fallback for missing values", () => {
    expect(safeNextPath(null, "/")).toBe("/");
    expect(safeNextPath(undefined, "/login")).toBe("/login");
  });
});
