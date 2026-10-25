import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = "correct-horse-battery-staple";

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

/** Register through the UI and confirm the email using the development mailbox. */
export async function registerAndVerify(page: Page, request: APIRequestContext, tag: string): Promise<string> {
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

export async function payInSandbox(page: Page, outcome: "successful" | "declined" = "successful") {
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /^Pay / }).click();
  await page.waitForURL(/\/checkout\/sandbox\//);
  await expect(page.getByText("Test payment gateway")).toBeVisible();
  await page.getByRole("button", { name: `Simulate ${outcome} payment` }).click();
  await page.waitForURL(/\/checkout\/return/);
}

export async function waitForOrderStatus(page: Page, label: string) {
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
