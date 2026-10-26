/** Client-safe date/duration formatting helpers (UTC-stored dates, locale display). */

export function formatDateTime(date: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!date) return "Not yet";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", ...opts }).format(d);
}

export function formatDate(date: Date | string | null | undefined): string {
  return formatDateTime(date, { dateStyle: "medium", timeStyle: undefined });
}

export function formatRelative(date: Date | string | null | undefined, now: Date = new Date()): string {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function formatTerm(term: string | null | undefined): string {
  if (!term) return "Not specified";
  const m = /^(\d+)([hd])$/.exec(term);
  if (!m) return term;
  const n = Number(m[1]);
  if (m[2] === "h") return `${n} hour${n === 1 ? "" : "s"}`;
  if (n === 365) return "1 year";
  if (n === 180) return "6 months";
  return `${n} day${n === 1 ? "" : "s"}`;
}

export function formatValidity(days: number | null | undefined): string {
  if (!days) return "Not specified";
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** Mask a phone number for lists: +44 7700 ••• 123 */
export function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, phone.length - 7)}•••${phone.slice(-3)}`;
}

/** "2026-10-24" (a UTC report day) as "24 Oct 2026". */
export function formatDayKey(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** "2026-10" (a UTC report month) as "October 2026". */
export function formatMonthKey(month: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

/** Machine keys such as job types ("fulfil-order-item") as words for staff screens. */
export function humanizeKey(key: string): string {
  return key.replace(/[-_.]+/g, " ").trim();
}
