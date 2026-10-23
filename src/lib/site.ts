/**
 * Public, non-secret site configuration. Safe for client and server code.
 * The brand name is configurable via NEXT_PUBLIC_APP_NAME at build time.
 */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "Roamwell",
  url: process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000",
  description:
    "Buy travel eSIM data plans and temporary phone numbers for SMS verification. Clear capabilities, server-verified payments and secure delivery to your private dashboard.",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com",
} as const;
