import "server-only";
import type { ProductType } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { getSetting } from "@/server/settings";
import {
  checkPromotion,
  priceWithRules,
  PricingError,
  type PriceBreakdown,
  type PricingRuleInput,
  type PromotionInput,
  type PromotionRejection,
} from "./engine";

/**
 * Database-backed pricing: loads active rules and the applicable exchange rate once,
 * then prices any number of products in memory (no N+1 queries).
 */

export interface PriceableProduct {
  id: string;
  type: ProductType;
  wholesaleCost: { toString(): string };
  wholesaleCurrency: string;
  countryId: string | null;
  destinationId: string | null;
  serviceId: string | null;
}

export interface FxRate {
  id: string;
  rate: string;
  source: string;
  effectiveAt: Date;
}

export interface PricingSession {
  currency: string;
  rules: PricingRuleInput[];
  rates: Map<string, FxRate | null>; // keyed by supplier currency
  price(product: PriceableProduct, promotion?: PromotionInput | null): PriceBreakdown;
  tryPrice(product: PriceableProduct): PriceBreakdown | null;
}

export function checkoutCurrency(): string {
  return getEnv().PAYMENT_CURRENCY;
}

/** Latest staff-entered rate base→quote that is not older than the configured max age. */
export async function getFreshRate(base: string, quote: string, now = new Date()): Promise<FxRate | null> {
  if (base === quote) return null;
  const maxAgeHours = await getSetting("pricing.fxMaxAgeHours");
  const notBefore = new Date(now.getTime() - maxAgeHours * 3600 * 1000);
  const row = await db.exchangeRate.findFirst({
    where: { baseCurrency: base, quoteCurrency: quote, effectiveAt: { lte: now, gte: notBefore } },
    orderBy: { effectiveAt: "desc" },
  });
  return row ? { id: row.id, rate: row.rate.toString(), source: row.source, effectiveAt: row.effectiveAt } : null;
}

export async function createPricingSession(supplierCurrencies: string[] = [getEnv().SUPPLIER_PRICE_CURRENCY]): Promise<PricingSession> {
  const currency = checkoutCurrency();
  const [ruleRows, ...rateRows] = await Promise.all([
    db.pricingRule.findMany({ where: { isActive: true } }),
    ...supplierCurrencies.map((c) => getFreshRate(c, currency)),
  ]);

  const rules: PricingRuleInput[] = ruleRows.map((r) => ({
    id: r.id,
    productType: r.productType,
    countryId: r.countryId,
    destinationId: r.destinationId,
    serviceId: r.serviceId,
    productId: r.productId,
    markupPercent: r.markupPercent.toString(),
    markupFixed: r.markupFixed.toString(),
    minProfit: r.minProfit ? r.minProfit.toString() : null,
    fixedPrice: r.fixedPrice ? r.fixedPrice.toString() : null,
    currency: r.currency,
    priority: r.priority,
    isActive: r.isActive,
  }));

  const rates = new Map<string, FxRate | null>();
  supplierCurrencies.forEach((c, i) => rates.set(c, rateRows[i] ?? null));

  const price = (product: PriceableProduct, promotion?: PromotionInput | null): PriceBreakdown => {
    const ctx = {
      productType: product.type,
      productId: product.id,
      countryId: product.countryId,
      destinationId: product.destinationId,
      serviceId: product.serviceId,
    };
    const rate = product.wholesaleCurrency === currency ? null : (rates.get(product.wholesaleCurrency) ?? null);
    return priceWithRules(rules, ctx, {
      supplierCost: product.wholesaleCost.toString(),
      supplierCurrency: product.wholesaleCurrency,
      currency,
      exchangeRate: rate ? rate.rate : null,
      promotion,
    });
  };

  return {
    currency,
    rules,
    rates,
    price,
    tryPrice(product) {
      try {
        return price(product);
      } catch (err) {
        if (err instanceof PricingError) return null;
        throw err;
      }
    },
  };
}

export async function findPromotion(code: string): Promise<PromotionInput | null> {
  const promo = await db.promotion.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!promo) return null;
  return {
    id: promo.id,
    code: promo.code,
    percentOff: promo.percentOff?.toString() ?? null,
    amountOff: promo.amountOff?.toString() ?? null,
    currency: promo.currency,
    productType: promo.productType,
    minOrderAmount: promo.minOrderAmount?.toString() ?? null,
    maxRedemptions: promo.maxRedemptions,
    redemptionCount: promo.redemptionCount,
    startsAt: promo.startsAt,
    endsAt: promo.endsAt,
    isActive: promo.isActive,
  };
}

export const PROMOTION_MESSAGES: Record<PromotionRejection, string> = {
  inactive: "This promotion code is not active.",
  not_started: "This promotion has not started yet.",
  expired: "This promotion has expired.",
  exhausted: "This promotion has reached its redemption limit.",
  wrong_product: "This promotion does not apply to this product.",
  below_minimum: "Your order does not meet this promotion's minimum amount.",
  currency_mismatch: "This promotion cannot be used with the checkout currency.",
};

export { checkPromotion, PricingError };
