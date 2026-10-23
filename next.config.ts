import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy.
 * - Scripts: Next.js App Router emits inline bootstrap scripts, so 'unsafe-inline' is
 *   required unless nonce-based CSP is adopted (see docs/SECURITY.md).
 * - Images: supplier-hosted QR codes and service icons are loaded over https.
 * - Payments use a hosted checkout redirect, so no third-party script origins are needed.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.paystack.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  // Cache Components is intentionally disabled: nearly every route is per-user or
  // database-backed. Catalogue freshness is managed explicitly in the database
  // (see docs/ARCHITECTURE.md, "Caching").
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
