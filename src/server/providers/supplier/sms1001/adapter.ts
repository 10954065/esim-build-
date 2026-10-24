import { z } from "zod";
import type { SupplierAdapter } from "../types";
import { Sms1001Client, type Sms1001ClientConfig } from "./client";
import {
  mapActivation,
  mapDestination,
  mapEsimOrder,
  mapOffer,
  mapRental,
  mapTermPrice,
  mapUnknownTerms,
  mergeActivationCheck,
} from "./mappers";
import {
  activationCancelSchema,
  activationCheckSchema,
  activationListSchema,
  activationOrderSchema,
  balanceSchema,
  countrySchema,
  destinationsSchema,
  esimOrderListSchema,
  esimOrderSchema,
  numberAvailabilitySchema,
  numberCancelSchema,
  numberCountrySchema,
  numberListSchema,
  numberPricingSchema,
  numberSchema,
  packagesSchema,
  pricingByCountrySchema,
  pricingCountryServiceSchema,
  serviceSchema,
} from "./schemas";
import { mapPackage } from "./mappers";
import { createSignedWebhookVerifier } from "./webhook";

export interface Sms1001AdapterConfig extends Sms1001ClientConfig {
  webhookSecret: string | undefined;
  priceCurrency: string;
}

/** Validate list items individually, dropping malformed entries. */
function parseEach<S extends z.ZodTypeAny>(schema: S, items: unknown[]): z.output<S>[] {
  const out: z.output<S>[] = [];
  for (const item of items) {
    const parsed = schema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export function createSms1001Adapter(config: Sms1001AdapterConfig): SupplierAdapter {
  const client = new Sms1001Client(config);

  return {
    code: "1001sms",
    name: "1001SMS",
    mode: "LIVE",
    priceCurrency: config.priceCurrency,

    esim: {
      async listDestinations() {
        const data = await client.request("GET", "/esims/destinations", { schema: destinationsSchema });
        return data.destinations.map(mapDestination);
      },
      async listPackages(locationCode) {
        const data = await client.request("GET", "/esims/packages", {
          schema: packagesSchema,
          query: { location: locationCode },
        });
        return data.packages.map(mapPackage);
      },
      async orderEsim({ packageCode, quantity, days }) {
        const data = await client.request("POST", "/esims/order", {
          schema: esimOrderSchema,
          body: { packageCode, quantity, ...(days ? { days } : {}) },
          mutating: true,
        });
        return mapEsimOrder(data);
      },
      async getEsimOrder(id, opts) {
        const data = await client.request("GET", `/esims/orders/${encodeURIComponent(id)}`, {
          schema: esimOrderSchema,
          query: opts?.refresh ? { refresh: 1 } : undefined,
        });
        return mapEsimOrder(data);
      },
      async listEsimOrders(page, limit) {
        const data = await client.request("GET", "/esims/orders", {
          schema: esimOrderListSchema,
          query: { page, limit: Math.min(limit, 100) },
        });
        return {
          items: parseEach(esimOrderSchema, data.orders).map(mapEsimOrder),
          total: data.total,
          page: data.page,
          limit: data.limit,
        };
      },
    },

    verification: {
      async listCountries() {
        const data = await client.request("GET", "/informative/countries", { schema: z.array(countrySchema) });
        return data.map((c) => ({
          code: c.code.toUpperCase(),
          name: c.name,
          slug: c.slug,
          phoneCode: c.phoneCode ?? null,
          continent: c.continent ?? null,
        }));
      },
      async listServices() {
        const data = await client.request("GET", "/informative/services", { schema: z.array(serviceSchema) });
        return data.map((s) => ({ slug: s.slug, name: s.name, iconUrl: s.iconPath ?? null, popular: s.popular }));
      },
      async getOffers({ countryCode, serviceSlug }) {
        if (serviceSlug) {
          const data = await client.request("GET", "/informative/pricing", {
            schema: pricingCountryServiceSchema,
            query: { country: countryCode, service: serviceSlug },
          });
          return data.operators.map((op) => mapOffer(countryCode, serviceSlug, serviceSlug, op));
        }
        const data = await client.request("GET", "/informative/pricing", {
          schema: pricingByCountrySchema,
          query: { country: countryCode },
        });
        return data.services.flatMap((s) =>
          s.operators.map((op) => mapOffer(countryCode, s.service, s.serviceName ?? s.service, op)),
        );
      },
      async orderActivation({ countryCode, serviceSlug, providerTier, operator }) {
        const data = await client.request("POST", "/activations/order", {
          schema: activationOrderSchema,
          body: {
            country: countryCode,
            service: serviceSlug,
            provider: providerTier,
            purchaseType: "activation",
            ...(operator ? { operator } : {}),
          },
          mutating: true,
        });
        return mapActivation(data, countryCode);
      },
      async getActivation(id) {
        const order = await client.request("GET", `/activations/${encodeURIComponent(id)}`, {
          schema: activationOrderSchema,
        });
        const base = mapActivation(order);
        // POST /activations/check is the documented way to pull fresh messages.
        const check = await client.request("POST", "/activations/check", {
          schema: activationCheckSchema,
          body: { orderId: id },
        });
        return mergeActivationCheck(base, check);
      },
      async cancelActivation(id) {
        const data = await client.request("POST", "/activations/cancel", {
          schema: activationCancelSchema,
          body: { orderId: id },
          mutating: true,
        });
        return {
          state: data.status.toUpperCase() === "REFUNDED" ? "REFUNDED" : "CANCELLED",
          supplierStatus: data.status,
          refundAmount: data.refundAmount ?? "0",
        };
      },
      async listRecentActivations(page, limit) {
        const data = await client.request("GET", "/activations/history", {
          schema: activationListSchema,
          query: { page, limit: Math.min(limit, 100) },
        });
        return {
          items: parseEach(activationOrderSchema, data.orders).map((o) => mapActivation(o)),
          total: data.total,
          page: data.page,
          limit: data.limit,
        };
      },
    },

    rentals: {
      async listRentalCountries() {
        const data = await client.request("GET", "/numbers/countries", { schema: z.array(numberCountrySchema) });
        return data.map((c) => ({ code: c.code.toUpperCase(), name: c.name, phoneCode: c.phoneCode ?? null, types: c.types }));
      },
      async getRentalPricing(countryCode) {
        const data = await client.request("GET", "/numbers/pricing", {
          schema: numberPricingSchema,
          query: { country: countryCode },
        });
        return {
          countryCode: countryCode.toUpperCase(),
          unlimited: data.unlimited.map(mapTermPrice),
          services: data.services
            .map((s) => ({ serviceSlug: s.service, serviceName: s.name ?? s.service, terms: mapUnknownTerms(s.terms) }))
            .filter((s) => s.terms.length > 0),
        };
      },
      async getRentalAvailability(countryCode, term) {
        const data = await client.request("GET", "/numbers/availability", {
          schema: numberAvailabilitySchema,
          query: { country: countryCode, term },
        });
        return { inStock: data.inStock, count: data.count };
      },
      async orderRental({ countryCode, term, rentalType, serviceSlug }) {
        const data = await client.request("POST", "/numbers/order", {
          schema: numberSchema,
          body: {
            country: countryCode,
            term,
            type: rentalType,
            ...(serviceSlug ? { service: serviceSlug } : {}),
            // Never let the supplier auto-renew: renewals must be paid by the customer first.
            autoRenew: false,
          },
          mutating: true,
        });
        return mapRental(data);
      },
      async getRental(id) {
        const data = await client.request("GET", `/numbers/${encodeURIComponent(id)}`, { schema: numberSchema });
        return mapRental(data);
      },
      async cancelRental(id) {
        const data = await client.request("POST", `/numbers/${encodeURIComponent(id)}/cancel`, {
          schema: numberCancelSchema,
          mutating: true,
        });
        const status = String(data.number.status ?? "CANCELLED").toUpperCase();
        return {
          state: status === "REFUNDED" ? "REFUNDED" : "CANCELLED",
          refundAmount: data.refundAmount ?? "0",
        };
      },
      async listRentals(page, limit) {
        const data = await client.request("GET", "/numbers", {
          schema: numberListSchema,
          query: { page, limit: Math.min(limit, 100) },
        });
        return {
          items: parseEach(numberSchema, data.numbers).map(mapRental),
          total: data.total,
          page: data.page,
          limit: data.limit,
        };
      },
    },

    account: {
      async getBalance() {
        const data = await client.request("GET", "/informative/balance", { schema: balanceSchema });
        return { balance: data.balance };
      },
    },

    webhooks: createSignedWebhookVerifier(config.webhookSecret),
  };
}
