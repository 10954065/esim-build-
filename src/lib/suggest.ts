/**
 * Type-ahead matching for country, destination and service search. Client-safe and pure:
 * ranks exact and prefix matches first, then word starts, then anywhere in the name.
 */

export interface SuggestOption {
  label: string;
  href: string;
  /** ISO 3166-1 alpha-2 code, when the option is a country. */
  code?: string | null;
  kind?: "COUNTRY" | "REGION" | "GLOBAL";
  /** Short context shown beside the name, e.g. "Region" or "SMS numbers". */
  hint?: string;
}

/** Names people type that are not in the official country name. */
const ALIASES: Record<string, readonly string[]> = {
  GB: ["uk", "britain", "great britain", "england"],
  US: ["usa", "america"],
  AE: ["uae", "dubai"],
};

const DEFAULT_LIMIT = 8;

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function score(option: SuggestOption, q: string): number | null {
  const label = normalizeSearch(option.label);
  if (label === q) return 0;
  const code = option.code?.toUpperCase() ?? "";
  if (label.startsWith(q) || code.toLowerCase() === q || (ALIASES[code] ?? []).some((a) => a.startsWith(q))) return 1;
  if (label.split(/[\s\-'(),]+/).some((word) => word.startsWith(q))) return 2;
  if (label.includes(q)) return 3;
  return null;
}

export function suggest(options: readonly SuggestOption[], query: string, limit = DEFAULT_LIMIT): SuggestOption[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  return options
    .map((option) => ({ option, rank: score(option, q) }))
    .filter((r): r is { option: SuggestOption; rank: number } => r.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.option.label.localeCompare(b.option.label))
    .slice(0, limit)
    .map((r) => r.option);
}
