/**
 * SANDBOX FIXTURES: clearly fictional demo data for development and automated tests.
 * None of these records represent real supplier inventory or real prices.
 */

import type {
  EsimDestinationInfo,
  EsimPackageInfo,
  RentalCountry,
  RentalPricing,
  SupplierCountry,
  SupplierService,
  VerificationOffer,
} from "../types";

export const SANDBOX_COUNTRIES: SupplierCountry[] = [
  { code: "US", name: "United States", slug: "united-states", phoneCode: "+1", continent: "NORTH_AMERICA" },
  { code: "GB", name: "United Kingdom", slug: "united-kingdom", phoneCode: "+44", continent: "EUROPE" },
  { code: "DE", name: "Germany", slug: "germany", phoneCode: "+49", continent: "EUROPE" },
  { code: "FR", name: "France", slug: "france", phoneCode: "+33", continent: "EUROPE" },
  { code: "ES", name: "Spain", slug: "spain", phoneCode: "+34", continent: "EUROPE" },
  { code: "GH", name: "Ghana", slug: "ghana", phoneCode: "+233", continent: "AFRICA" },
  { code: "NG", name: "Nigeria", slug: "nigeria", phoneCode: "+234", continent: "AFRICA" },
  { code: "JP", name: "Japan", slug: "japan", phoneCode: "+81", continent: "ASIA" },
  { code: "BR", name: "Brazil", slug: "brazil", phoneCode: "+55", continent: "SOUTH_AMERICA" },
  { code: "CA", name: "Canada", slug: "canada", phoneCode: "+1", continent: "NORTH_AMERICA" },
];

export const SANDBOX_SERVICES: SupplierService[] = [
  { slug: "google", name: "Google", iconUrl: null, popular: true },
  { slug: "telegram", name: "Telegram", iconUrl: null, popular: true },
  { slug: "whatsapp", name: "WhatsApp", iconUrl: null, popular: true },
  { slug: "microsoft", name: "Microsoft", iconUrl: null, popular: false },
  { slug: "amazon", name: "Amazon", iconUrl: null, popular: false },
  { slug: "uber", name: "Uber", iconUrl: null, popular: false },
  { slug: "demo-fail", name: "Demo: supplier failure", iconUrl: null, popular: false },
];

/** Deterministic pseudo-random number in [0, 1) from a string. */
export function seeded(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function cents(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function sandboxOffers(countryCode: string): VerificationOffer[] {
  const country = SANDBOX_COUNTRIES.find((c) => c.code === countryCode.toUpperCase());
  if (!country) return [];
  const offers: VerificationOffer[] = [];
  for (const service of SANDBOX_SERVICES) {
    for (const tier of ["MAIN", "EXTRA"]) {
      const r = seeded(`${country.code}:${service.slug}:${tier}`);
      offers.push({
        countryCode: country.code,
        serviceSlug: service.slug,
        serviceName: service.name,
        providerTier: tier,
        operator: tier === "MAIN" ? "demo-operator-a" : "demo-operator-b",
        cost: cents(0.15 + r * 0.9),
        // The MAIN tier for demo-fail and a few deterministic combinations are out of
        // stock to exercise empty states; demo-fail EXTRA stays in stock to test failures.
        stock: service.slug === "demo-fail" && tier === "EXTRA" ? 999 : r < 0.12 ? 0 : Math.floor(50 + r * 5000),
        deliverability: Math.floor(55 + r * 40),
      });
    }
  }
  return offers;
}

export const SANDBOX_DESTINATIONS: EsimDestinationInfo[] = [
  { locationCode: "ES", name: "Spain", kind: "COUNTRY", packageCount: 5, fromCost: null, topSpeed: "5G" },
  { locationCode: "US", name: "United States", kind: "COUNTRY", packageCount: 5, fromCost: null, topSpeed: "5G" },
  { locationCode: "GB", name: "United Kingdom", kind: "COUNTRY", packageCount: 5, fromCost: null, topSpeed: "5G" },
  { locationCode: "FR", name: "France", kind: "COUNTRY", packageCount: 5, fromCost: null, topSpeed: "5G" },
  { locationCode: "JP", name: "Japan", kind: "COUNTRY", packageCount: 5, fromCost: null, topSpeed: "4G" },
  { locationCode: "GH", name: "Ghana", kind: "COUNTRY", packageCount: 5, fromCost: null, topSpeed: "4G" },
  { locationCode: "EU-DEMO", name: "Europe (demo region)", kind: "REGION", packageCount: 5, fromCost: null, topSpeed: "5G" },
  { locationCode: "GLOBAL-DEMO", name: "Global (demo)", kind: "GLOBAL", packageCount: 5, fromCost: null, topSpeed: "4G" },
];

const GB = 1024 ** 3;

const PACKAGE_SHAPES = [
  { suffix: "1GB-7D", label: "1 GB", bytes: 1 * GB, days: 7, base: 3.2, unlimited: false },
  { suffix: "3GB-15D", label: "3 GB", bytes: 3 * GB, days: 15, base: 7.5, unlimited: false },
  { suffix: "5GB-30D", label: "5 GB", bytes: 5 * GB, days: 30, base: 11.0, unlimited: false },
  { suffix: "10GB-30D", label: "10 GB", bytes: 10 * GB, days: 30, base: 18.0, unlimited: false },
  { suffix: "UNL-1D", label: "1 GB/day", bytes: 1 * GB, days: 1, base: 1.9, unlimited: true },
] as const;

export function sandboxPackages(locationCode: string): EsimPackageInfo[] {
  const dest = SANDBOX_DESTINATIONS.find((d) => d.locationCode === locationCode);
  if (!dest) return [];
  const factor = 0.8 + seeded(locationCode) * 0.6;
  const packages: EsimPackageInfo[] = PACKAGE_SHAPES.map((shape) => ({
    packageCode: `SBX-${dest.locationCode}-${shape.suffix}`,
    name: `${dest.name} ${shape.label}${shape.unlimited ? " day pass" : ` · ${shape.days} days`}`,
    locationCode: dest.locationCode,
    locationName: dest.name,
    dataLabel: shape.label,
    volumeBytes: BigInt(shape.bytes),
    durationDays: shape.days,
    speed: dest.topSpeed,
    cost: cents(shape.base * factor),
    unlimited: shape.unlimited,
    pricingUnit: shape.unlimited ? "per_day" : null,
    fupPolicy: shape.unlimited ? "1 Mbps after daily allowance" : null,
    ipExport: dest.kind === "COUNTRY" ? dest.locationCode : null,
    includesPhoneNumber: false,
    includesSms: false,
    includesVoice: false,
  }));
  // Spain also carries a package that always fails at the supplier, for failure tests.
  if (dest.locationCode === "ES") {
    packages.push({
      ...packages[0]!,
      packageCode: "SBX-ES-TEST-FAIL",
      name: "Spain 1 GB · supplier failure test",
      cost: "0.50",
    });
  }
  return packages;
}

export const SANDBOX_RENTAL_COUNTRIES: RentalCountry[] = [
  { code: "US", name: "United States", phoneCode: "+1", types: ["unlimited", "service"] },
  { code: "GB", name: "United Kingdom", phoneCode: "+44", types: ["unlimited"] },
];

export const RENTAL_TERMS: Array<{ term: string; days: number | null; hours: number | null; base: number }> = [
  { term: "1d", days: 1, hours: 24, base: 1.2 },
  { term: "7d", days: 7, hours: 168, base: 4.5 },
  { term: "30d", days: 30, hours: 720, base: 12.5 },
];

export function sandboxRentalPricing(countryCode: string): RentalPricing {
  const code = countryCode.toUpperCase();
  const supported = SANDBOX_RENTAL_COUNTRIES.find((c) => c.code === code);
  if (!supported) return { countryCode: code, unlimited: [], services: [] };
  const factor = 0.9 + seeded(`rent:${code}`) * 0.3;
  const unlimited = RENTAL_TERMS.map((t) => ({ term: t.term, days: t.days, hours: t.hours, cost: cents(t.base * factor) }));
  const services = supported.types.includes("service")
    ? [
        {
          serviceSlug: "telegram",
          serviceName: "Telegram",
          terms: RENTAL_TERMS.map((t) => ({ term: t.term, days: t.days, hours: t.hours, cost: cents(t.base * factor * 0.6) })),
        },
      ]
    : [];
  return { countryCode: code, unlimited, services };
}

/** Fictional numbers only: US 555-01xx range and UK Ofcom drama range 07700 900xxx. */
export function sandboxPhoneNumber(countryCode: string, key: string): string {
  const n = Math.floor(seeded(key) * 100);
  if (countryCode.toUpperCase() === "GB") return `+447700900${String(n).padStart(3, "0")}`;
  return `+1555010${String(n % 100).padStart(2, "0")}`;
}
