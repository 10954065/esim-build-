import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const PASSWORD = "correct-horse-battery-staple";

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

/** Register through the UI and confirm the email using the development mailbox. */
async function registerAndVerify(page: Page, request: APIRequestContext, tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  await page.goto("/register");
  await page.getByLabel("Full name").fill("E2E Customer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();

  let link: string | undefined;
  await expect
    .poll(async () => {
      const html = await (await request.get(`/dev/mailbox?to=${encodeURIComponent(email)}`)).text();
      link = /href=&quot;(http[^&]*?\/api\/auth\/verify-email[^"]*?)&quot;/.exec(html)?.[1]?.replace(/&amp;amp;|&amp;/g, "&");
      return link;
    })
    .toBeTruthy();
  await page.goto(link!);
  await page.waitForURL(/\/dashboard/);
  return email;
}

async function payInSandbox(page: Page, outcome: "successful" | "declined" = "successful") {
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /^Pay / }).click();
  await page.waitForURL(/\/checkout\/sandbox\//);
  await expect(page.getByText("Test payment gateway")).toBeVisible();
  await page.getByRole("button", { name: `Simulate ${outcome} payment` }).click();
  await page.waitForURL(/\/checkout\/return/);
}

async function waitForOrderStatus(page: Page, label: string) {
  await expect
    .poll(
      async () => {
        await page.reload();
        return page.locator("main").innerText();
      },
      { timeout: 45_000, intervals: [1500, 2000, 3000] },
    )
    .toContain(label);
}

test("customer buys a travel eSIM and sees its installation QR code", async ({ page, request }) => {
  await registerAndVerify(page, request, "esim");

  await page.goto("/esims");
  await expect(page.getByRole("heading", { name: "Mobile data for wherever you land" })).toBeVisible();
  await expect(page.getByText("These are data-only eSIMs")).toBeVisible();
  await page.getByRole("link", { name: /Spain/ }).first().click();
  await expect(page.getByRole("link", { name: "View plan" }).first()).toBeVisible();
  // The cheapest Spain plan is the deliberate supplier-failure fixture; buy a normal plan.
  await page.goto("/esims/spain/sbx-es-1gb-7d");
  await expect(page.getByText("Data only · no phone number")).toBeVisible();
  await page.getByRole("link", { name: "Continue to checkout" }).click();

  await expect(page.getByText("Total to pay")).toBeVisible();
  await payInSandbox(page);
  await expect(page.getByRole("heading", { name: /Payment confirmed|Confirming your payment/ })).toBeVisible();
  await page.getByRole("link", { name: "View order" }).click();
  await page.waitForURL(/\/dashboard\/orders\/[0-9a-f-]+$/);
  await waitForOrderStatus(page, "Completed");

  await page.getByRole("link", { name: /Open/ }).first().click();
  await expect(page.getByAltText("eSIM installation QR code")).toBeVisible();
  await expect(page.getByText(/demo eSIM/)).toBeVisible();
  await page.getByRole("button", { name: "Reveal" }).click();
  await expect(page.getByText(/sandbox-smdp\.invalid/).first()).toBeVisible();
});

test("verification SMS is delivered and visible only to the number's owner", async ({ page, request, browser }) => {
  await registerAndVerify(page, request, "verify");
  await page.goto("/verification/united-states/google");
  await page.getByRole("link", { name: "Buy" }).first().click();
  await payInSandbox(page);
  await page.getByRole("link", { name: "View order" }).click();
  await page.waitForURL(/\/dashboard\/orders\/[0-9a-f-]+$/);
  await waitForOrderStatus(page, "Completed");
  await page.getByRole("link", { name: /Open/ }).first().click();
  await expect(page.getByText("Your number")).toBeVisible();

  await page.getByRole("button", { name: "Simulate SMS (demo)" }).click();
  await expect(page.getByText(/Your demo verification code is \d{6}/)).toBeVisible();
  const sessionUrl = page.url();

  // A different customer cannot open this session.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await registerAndVerify(otherPage, other.request, "intruder");
  const res = await otherPage.goto(sessionUrl);
  expect(res?.status()).toBe(404);
  await other.close();
});

test("a declined payment does not create a product", async ({ page, request }) => {
  await registerAndVerify(page, request, "declined");
  await page.goto("/esims/spain");
  await page.getByRole("link", { name: "View plan" }).first().click();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await payInSandbox(page, "declined");
  await expect(page.getByRole("heading", { name: "Payment was not completed" })).toBeVisible();
  await page.goto("/dashboard/esims");
  await expect(page.getByText("No eSIMs yet")).toBeVisible();
});

test("customers cannot reach the admin area and guests are sent to sign in", async ({ page, request }) => {
  await page.goto("/dashboard/orders");
  expect(page.url()).toContain("/login");

  await registerAndVerify(page, request, "noadmin");
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  const api = await request.get("/api/cron/jobs");
  expect(api.status()).toBe(401);
});

test("@mobile homepage and navigation work on a phone without horizontal scrolling", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "Travel eSIMs" }).last()).toBeVisible();
  await page.getByRole("link", { name: "Verification numbers" }).last().click();
  await expect(page).toHaveURL(/\/verification/);
});
