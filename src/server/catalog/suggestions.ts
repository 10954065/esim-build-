import "server-only";
import type { DestinationKind } from "@/generated/prisma/client";
import type { SuggestOption } from "@/lib/suggest";
import { db } from "@/server/db";

/**
 * Lightweight option lists for search type-ahead: names, links and flags only (no pricing),
 * so every page with a search box can load the full list cheaply.
 */

const KIND_HINT: Record<DestinationKind, string | undefined> = { COUNTRY: undefined, REGION: "Region", GLOBAL: "Global" };

export async function destinationSuggestions(): Promise<SuggestOption[]> {
  const rows = await db.esimDestination.findMany({
    where: { isActive: true, isEnabled: true },
    select: { slug: true, name: true, kind: true, country: { select: { code: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((d) => ({
    label: d.name,
    href: `/esims/${d.slug}`,
    code: d.country?.code ?? null,
    kind: d.kind,
    ...(KIND_HINT[d.kind] ? { hint: KIND_HINT[d.kind] } : {}),
  }));
}

export async function verificationCountrySuggestions(): Promise<SuggestOption[]> {
  const rows = await db.country.findMany({
    where: { isEnabled: true, hasVerification: true },
    select: { code: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((c) => ({ label: c.name, href: `/verification/${c.slug}`, code: c.code }));
}
