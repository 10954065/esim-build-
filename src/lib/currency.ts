/**
 * ISO 4217 minor-unit exponents and display formatting. Client-safe (no secrets).
 * Amounts are passed around as decimal strings; formatting never does arithmetic.
 */

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "XAF", "XOF", "RWF", "PYG", "GNF", "KMF"]);
const THREE_DECIMAL = new Set(["BHD", "KWD", "OMR", "JOD", "TND", "LYD", "IQD"]);

export function minorUnitExponent(currency: string): number {
  const c = currency.toUpperCase();
  if (ZERO_DECIMAL.has(c)) return 0;
  if (THREE_DECIMAL.has(c)) return 3;
  return 2;
}

/** Format a decimal string for display, e.g. formatMoney("12.5", "USD") → "$12.50". */
export function formatMoney(amount: string | number, currency: string, locale = "en"): string {
  const exp = minorUnitExponent(currency);
  const value = typeof amount === "number" ? amount : Number(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    }).format(value);
  } catch {
    return `${value.toFixed(exp)} ${currency.toUpperCase()}`;
  }
}

export function formatBytes(bytes: bigint | number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  const n = Number(bytes);
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(n % 1024 ** 3 === 0 ? 0 : 1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.round(n / 1024)} KB`;
}
