import { describe, expect, it } from "vitest";
import { can, isStaffRole, PERMISSIONS, permissionsFor } from "./permissions";

describe("permission matrix", () => {
  it("gives customers no staff permissions", () => {
    for (const p of PERMISSIONS) expect(can("user", p)).toBe(false);
    expect(isStaffRole("user")).toBe(false);
  });

  it("rejects unknown or missing roles", () => {
    expect(can(undefined, "admin.access")).toBe(false);
    expect(can("superuser", "admin.access")).toBe(false);
    expect(permissionsFor("hacker")).toEqual([]);
  });

  it("lets support handle tickets but not money or users", () => {
    expect(can("support", "support.manage")).toBe(true);
    expect(can("support", "orders.read")).toBe(true);
    expect(can("support", "refunds.manage")).toBe(false);
    expect(can("support", "users.manage")).toBe(false);
    expect(can("support", "orders.manual_fulfil")).toBe(false);
  });

  it("lets finance refund and price but not manage users or settings", () => {
    expect(can("finance", "refunds.manage")).toBe(true);
    expect(can("finance", "pricing.manage")).toBe(true);
    expect(can("finance", "reports.read")).toBe(true);
    expect(can("finance", "users.manage")).toBe(false);
    expect(can("finance", "settings.manage")).toBe(false);
  });

  it("gives admins everything", () => {
    for (const p of PERMISSIONS) expect(can("admin", p)).toBe(true);
  });
});
