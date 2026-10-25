import { execSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, payInSandbox, registerAndVerify, waitForOrderStatus } from "./helpers";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const PUBLIC_PAGES = [
  "/",
  "/esims",
  "/esims/spain",
  "/esims/spain/sbx-es-1gb-7d",
  "/verification",
  "/verification/united-states",
  "/verification/united-states/google",
  "/numbers/rentals",
  "/how-it-works",
  "/help",
  "/faq",
  "/contact",
  "/terms",
  "/login",
  "/register",
];

const DASHBOARD_PAGES = [
  "/dashboard",
  "/dashboard/orders",
  "/dashboard/esims",
  "/dashboard/verification",
  "/dashboard/rentals",
  "/dashboard/transactions",
  "/dashboard/refunds",
  "/dashboard/support",
  "/dashboard/support/new",
  "/dashboard/profile",
  "/dashboard/security",
];

const ADMIN_PAGES = [
  "/admin",
  "/admin/orders",
  "/admin/esims",
  "/admin/verification",
  "/admin/rentals",
  "/admin/support",
  "/admin/users",
  "/admin/payments",
  "/admin/refunds",
  "/admin/analytics",
  "/admin/pricing",
  "/admin/products",
  "/admin/countries",
  "/admin/services",
  "/admin/suppliers",
  "/admin/integrations",
  "/admin/audit-logs",
  "/admin/settings",
];

/** One line per violation and affected element, so a failure reads as a to-do list. */
async function audit(page: Page, label: string): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return violations.flatMap((v) => v.nodes.map((n) => `${label} · ${v.id} (${v.impact}) · ${n.target.join(" ")} · ${n.failureSummary?.split("\n")[1]?.trim() ?? v.help}`));
}

async function auditPaths(page: Page, paths: string[]): Promise<string[]> {
  const found: string[] = [];
  for (const path of paths) {
    await page.goto(path, { waitUntil: "networkidle" });
    found.push(...(await audit(page, path)));
  }
  return found;
}

test("public pages meet WCAG 2.1 AA (automated checks)", async ({ page }) => {
  expect(await auditPaths(page, PUBLIC_PAGES)).toEqual([]);
});

test("checkout and dashboard pages meet WCAG 2.1 AA (automated checks)", async ({ page, request }) => {
  test.setTimeout(120_000);
  await registerAndVerify(page, request, "a11y");
  const found: string[] = [];

  await page.goto("/esims/spain/sbx-es-1gb-7d");
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await expect(page.getByText("Total to pay")).toBeVisible();
  found.push(...(await audit(page, "/checkout")));

  await payInSandbox(page);
  await page.getByRole("link", { name: "View order" }).click();
  await page.waitForURL(/\/dashboard\/orders\//);
  await waitForOrderStatus(page, "Completed");
  found.push(...(await audit(page, "/dashboard/orders/[id]")));

  await page.getByRole("link", { name: /Open/ }).first().click();
  await expect(page.getByAltText("eSIM installation QR code")).toBeVisible();
  await page.getByRole("button", { name: "Reveal" }).click();
  found.push(...(await audit(page, "/dashboard/esims/[id]")));

  found.push(...(await auditPaths(page, DASHBOARD_PAGES)));
  expect(found).toEqual([]);
});

test("admin console meets WCAG 2.1 AA (automated checks)", async ({ page, request }) => {
  test.setTimeout(120_000);
  const email = await registerAndVerify(page, request, "a11y-admin");
  // Same audited CLI operators use; it signs the account out, so sign in again.
  execSync(`pnpm -s admin:grant ${email} admin`, { stdio: "ignore" });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);

  expect(await auditPaths(page, ADMIN_PAGES)).toEqual([]);
});
