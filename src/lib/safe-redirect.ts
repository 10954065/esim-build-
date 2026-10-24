/**
 * Only allow same-origin relative redirect targets ("/dashboard/orders"), never absolute
 * URLs, protocol-relative URLs ("//evil.com") or backslash tricks.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\r\n]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
