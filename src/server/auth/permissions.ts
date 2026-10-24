/**
 * Role-based permission matrix. Pure and client-safe (used to hide navigation), but
 * every server action and staff page enforces it again on the server.
 */

export type Role = "user" | "support" | "finance" | "admin";

export const PERMISSIONS = [
  "admin.access",
  "orders.read",
  "orders.manage", // retry fulfilment, resolve review
  "orders.manual_fulfil", // exceptional, audited manual fulfilment
  "users.read",
  "users.manage", // ban, role changes
  "catalog.read",
  "catalog.manage", // visibility, enable/disable, sync
  "pricing.read",
  "pricing.manage",
  "payments.read",
  "refunds.manage",
  "support.manage",
  "reports.read",
  "audit.read",
  "settings.manage",
  "integrations.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, readonly Permission[]> = {
  user: [],
  support: ["admin.access", "orders.read", "users.read", "catalog.read", "support.manage", "integrations.read"],
  finance: [
    "admin.access",
    "orders.read",
    "users.read",
    "catalog.read",
    "pricing.read",
    "pricing.manage",
    "payments.read",
    "refunds.manage",
    "reports.read",
    "audit.read",
  ],
  admin: PERMISSIONS,
};

export function isRole(value: unknown): value is Role {
  return value === "user" || value === "support" || value === "finance" || value === "admin";
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return MATRIX[role].includes(permission);
}

export function isStaffRole(role: string | null | undefined): boolean {
  return can(role, "admin.access");
}

export function permissionsFor(role: string | null | undefined): Permission[] {
  return isRole(role) ? [...MATRIX[role]] : [];
}
