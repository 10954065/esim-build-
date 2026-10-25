import { expect, test, type Locator, type Page } from "@playwright/test";
import { registerAndVerify, waitForOrderStatus } from "./helpers";

const MAX_TABS = 80;

/** Press Tab until `target` has focus, checking every stop shows a visible focus indicator. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press("Tab");
    const indicator = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return { ok: true, what: "body" };
      const s = getComputedStyle(el);
      const outline = s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) > 0;
      const ring = s.boxShadow !== "none";
      return { ok: outline || ring, what: `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 40)}"` };
    });
    expect(indicator.ok, `no visible focus indicator on ${indicator.what}`).toBe(true);
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`could not reach ${target} within ${MAX_TABS} tab stops`);
}

test("the first tab stop is a visible skip link that moves focus into the page", async ({ page }) => {
  await page.goto("/esims");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();

  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const insideMain = await page.evaluate(() => document.querySelector("main")?.contains(document.activeElement) ?? false);
  expect(insideMain).toBe(true);
});

test("a keyboard-only customer can buy an eSIM", async ({ page, request }) => {
  test.setTimeout(90_000);
  await registerAndVerify(page, request, "keyboard");

  await page.goto("/esims/spain/sbx-es-1gb-7d");
  await tabTo(page, page.getByRole("link", { name: "Continue to checkout" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("Total to pay")).toBeVisible();

  await tabTo(page, page.getByRole("checkbox"));
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox")).toBeChecked();
  await tabTo(page, page.getByRole("button", { name: /^Pay / }));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/checkout\/sandbox\//);

  await tabTo(page, page.getByRole("button", { name: "Simulate successful payment" }));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/checkout\/return/);
  await tabTo(page, page.getByRole("link", { name: "View order" }));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/dashboard\/orders\//);
  await waitForOrderStatus(page, "Completed");

  await tabTo(page, page.getByRole("link", { name: /Open/ }).first());
  await page.keyboard.press("Enter");
  await expect(page.getByAltText("eSIM installation QR code")).toBeVisible();
  await tabTo(page, page.getByRole("button", { name: "Reveal" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText(/sandbox-smdp\.invalid/).first()).toBeVisible();
});
