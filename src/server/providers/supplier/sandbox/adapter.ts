import { createHash } from "node:crypto";
import { SupplierError } from "../errors";
import { createSignedWebhookVerifier } from "../sms1001/webhook";
import type { ActivationInfo, EsimOrderInfo, RentalInfo, SupplierAdapter } from "../types";
import {
  RENTAL_TERMS,
  SANDBOX_COUNTRIES,
  SANDBOX_DESTINATIONS,
  SANDBOX_RENTAL_COUNTRIES,
  SANDBOX_SERVICES,
  sandboxOffers,
  sandboxPackages,
  sandboxPhoneNumber,
  sandboxRentalPricing,
} from "./fixtures";

/**
 * SANDBOX SUPPLIER — simulated fulfilment for development and tests.
 *
 * - Stateless: every supplier reference encodes its own parameters, so the adapter works
 *   across serverless invocations without hidden storage.
 * - Every issued item is unmistakably fake: activation codes point at the reserved
 *   `.invalid` domain and phone numbers come from ranges reserved for fiction.
 * - Incoming SMS are never generated here; they are simulated explicitly through a signed
 *   sandbox webhook (see /api/dev/simulate-sms) so tests control them.
 * - Failure triggers: service slug `demo-fail` or a package code ending in `-FAIL`.
 *
 * Env validation makes this adapter impossible to enable when APP_ENV=production.
 */

export const SANDBOX_SIGNATURE_HEADER = "x-sandbox-signature";
const ACTIVATION_TTL_MS = 20 * 60 * 1000;

interface EncodedRef {
  k: "act" | "esim" | "num";
  t: number; // created at (ms)
  [key: string]: string | number;
}

function encodeRef(ref: EncodedRef): string {
  return `sbx-${ref.k}.${Buffer.from(JSON.stringify(ref)).toString("base64url")}`;
}

function decodeRef(id: string, kind: EncodedRef["k"]): EncodedRef {
  const prefix = `sbx-${kind}.`;
  if (!id.startsWith(prefix)) throw new SupplierError("NOT_FOUND", "Unknown sandbox reference");
  try {
    const ref = JSON.parse(Buffer.from(id.slice(prefix.length), "base64url").toString("utf8")) as EncodedRef;
    if (ref.k !== kind || typeof ref.t !== "number") throw new Error("bad ref");
    return ref;
  } catch {
    throw new SupplierError("NOT_FOUND", "Malformed sandbox reference");
  }
}

function digest(input: string): string {
  return createHash("sha256").update(input).digest("hex").toUpperCase();
}

function activationFromRef(id: string, now: Date): ActivationInfo {
  const ref = decodeRef(id, "act");
  const created = new Date(ref.t);
  const expiresAt = new Date(ref.t + ACTIVATION_TTL_MS);
  const service = SANDBOX_SERVICES.find((s) => s.slug === ref.s);
  const cancelled = ref.x === 1;
  return {
    supplierOrderId: id,
    phoneNumber: String(ref.n),
    countryCode: String(ref.c),
    serviceSlug: String(ref.s),
    serviceName: service?.name ?? String(ref.s),
    operator: String(ref.o),
    providerTier: String(ref.p),
    cost: String(ref.cost),
    state: cancelled ? "CANCELLED" : now > expiresAt ? "EXPIRED" : "WAITING",
    supplierStatus: cancelled ? "CANCELLED" : now > expiresAt ? "EXPIRED" : "RENTED",
    expiresAt,
    createdAt: created,
    messages: [],
  };
}

function esimFromRef(id: string): EsimOrderInfo {
  const ref = decodeRef(id, "esim");
  const pkg = sandboxPackages(String(ref.l)).find((p) => p.packageCode === ref.p);
  const hash = digest(id);
  return {
    supplierOrderId: id,
    packageCode: String(ref.p),
    status: "ALLOCATED",
    lifecycle: "READY",
    ready: true,
    cost: String(ref.cost),
    createdAt: new Date(ref.t),
    profiles: [
      {
        supplierProfileId: `sbx-prof-${hash.slice(0, 16)}`,
        // 89 = telecom, 999 = not a real issuer country code: demo ICCID.
        iccid: `89999${BigInt(`0x${hash.slice(0, 12)}`).toString().padStart(14, "0").slice(0, 14)}`,
        activationCode: `LPA:1$sandbox-smdp.invalid$DEMO-${hash.slice(0, 20)}`,
        qrCodeUrl: null,
        apn: "demo.apn",
        status: "GOT_RESOURCE",
        smdpStatus: "RELEASED",
        totalVolumeBytes: pkg?.volumeBytes ?? null,
        usedVolumeBytes: BigInt(0),
        activatedAt: null,
        expiresAt: null,
      },
    ],
  };
}

function rentalFromRef(id: string, now: Date): RentalInfo {
  const ref = decodeRef(id, "num");
  const term = RENTAL_TERMS.find((t) => t.term === ref.term);
  const hours = term?.hours ?? 24;
  const expiresAt = new Date(ref.t + hours * 3600 * 1000);
  const cancelled = ref.x === 1;
  return {
    supplierNumberId: id,
    phoneNumber: String(ref.n),
    countryCode: String(ref.c),
    rentalType: String(ref.type),
    serviceSlug: ref.s ? String(ref.s) : null,
    serviceName: ref.s ? (SANDBOX_SERVICES.find((s) => s.slug === ref.s)?.name ?? String(ref.s)) : null,
    term: String(ref.term),
    state: cancelled ? "CANCELLED" : now > expiresAt ? "EXPIRED" : "ACTIVE",
    supplierStatus: cancelled ? "CANCELLED" : now > expiresAt ? "EXPIRED" : "ACTIVE",
    cost: String(ref.cost),
    rentedAt: new Date(ref.t),
    expiresAt,
    messages: [],
  };
}

export function createSandboxAdapter(opts: { signingSecret: string | undefined; priceCurrency: string; now?: () => Date }): SupplierAdapter {
  const now = opts.now ?? (() => new Date());

  return {
    code: "sandbox",
    name: "Sandbox supplier (demo)",
    mode: "SANDBOX",
    priceCurrency: opts.priceCurrency,

    esim: {
      async listDestinations() {
        return SANDBOX_DESTINATIONS.map((d) => {
          const pkgs = sandboxPackages(d.locationCode);
          const min = pkgs.reduce((m, p) => (Number(p.cost) < Number(m) ? p.cost : m), pkgs[0]?.cost ?? "0");
          return { ...d, packageCount: pkgs.length, fromCost: min };
        });
      },
      async listPackages(locationCode) {
        return sandboxPackages(locationCode);
      },
      async orderEsim({ packageCode }) {
        if (packageCode.endsWith("-FAIL")) {
          throw new SupplierError("PROVIDER_FAILED", "Simulated supplier failure (sandbox)", { httpStatus: 502 });
        }
        const dest = SANDBOX_DESTINATIONS.find((d) => packageCode.startsWith(`SBX-${d.locationCode}-`));
        const pkg = dest ? sandboxPackages(dest.locationCode).find((p) => p.packageCode === packageCode) : undefined;
        if (!dest || !pkg) throw new SupplierError("PRODUCT_UNAVAILABLE", "Unknown sandbox package", { httpStatus: 400 });
        const id = encodeRef({ k: "esim", t: now().getTime(), p: packageCode, l: dest.locationCode, cost: pkg.cost });
        return esimFromRef(id);
      },
      async getEsimOrder(id) {
        return esimFromRef(id);
      },
      async listEsimOrders(page, limit) {
        return { items: [], total: 0, page, limit };
      },
    },

    verification: {
      async listCountries() {
        return SANDBOX_COUNTRIES;
      },
      async listServices() {
        return SANDBOX_SERVICES;
      },
      async getOffers({ countryCode, serviceSlug }) {
        const offers = sandboxOffers(countryCode);
        return serviceSlug ? offers.filter((o) => o.serviceSlug === serviceSlug) : offers;
      },
      async orderActivation({ countryCode, serviceSlug, providerTier }) {
        if (serviceSlug === "demo-fail") {
          throw new SupplierError("PROVIDER_FAILED", "Simulated supplier failure (sandbox)", { httpStatus: 502 });
        }
        const offer = sandboxOffers(countryCode).find((o) => o.serviceSlug === serviceSlug && o.providerTier === providerTier);
        if (!offer || offer.stock === 0) {
          throw new SupplierError("PRODUCT_UNAVAILABLE", "No sandbox numbers available", { httpStatus: 400 });
        }
        const t = now().getTime();
        const id = encodeRef({
          k: "act",
          t,
          c: offer.countryCode,
          s: serviceSlug,
          p: providerTier,
          o: offer.operator,
          cost: offer.cost,
          n: sandboxPhoneNumber(offer.countryCode, `${t}:${serviceSlug}`),
        });
        return activationFromRef(id, now());
      },
      async getActivation(id) {
        return activationFromRef(id, now());
      },
      async cancelActivation(id) {
        const current = activationFromRef(id, now());
        if (current.state === "EXPIRED") {
          throw new SupplierError("INVALID_REQUEST", "Sandbox activation already expired", { httpStatus: 400 });
        }
        return { state: "REFUNDED", supplierStatus: "REFUNDED", refundAmount: current.cost };
      },
      async listRecentActivations(page, limit) {
        return { items: [], total: 0, page, limit };
      },
    },

    rentals: {
      async listRentalCountries() {
        return SANDBOX_RENTAL_COUNTRIES;
      },
      async getRentalPricing(countryCode) {
        return sandboxRentalPricing(countryCode);
      },
      async getRentalAvailability(countryCode, term) {
        const pricing = sandboxRentalPricing(countryCode);
        const inStock = pricing.unlimited.some((t) => t.term === term);
        return { inStock, count: inStock ? 25 : 0 };
      },
      async orderRental({ countryCode, term, rentalType, serviceSlug }) {
        const pricing = sandboxRentalPricing(countryCode);
        const list = rentalType === "service" ? pricing.services.find((s) => s.serviceSlug === serviceSlug)?.terms : pricing.unlimited;
        const price = list?.find((t) => t.term === term);
        if (!price) throw new SupplierError("PRODUCT_UNAVAILABLE", "Sandbox rental not available", { httpStatus: 400 });
        const t = now().getTime();
        const id = encodeRef({
          k: "num",
          t,
          c: countryCode.toUpperCase(),
          term,
          type: rentalType,
          s: serviceSlug ?? "",
          cost: price.cost,
          n: sandboxPhoneNumber(countryCode, `rent:${t}`),
        });
        return rentalFromRef(id, now());
      },
      async getRental(id) {
        return rentalFromRef(id, now());
      },
      async cancelRental(id) {
        const current = rentalFromRef(id, now());
        return { state: "REFUNDED", refundAmount: current.cost };
      },
      async listRentals(page, limit) {
        return { items: [], total: 0, page, limit };
      },
    },

    account: {
      async getBalance() {
        return { balance: "1000.00" };
      },
    },

    webhooks: createSignedWebhookVerifier(opts.signingSecret, SANDBOX_SIGNATURE_HEADER),
  };
}
