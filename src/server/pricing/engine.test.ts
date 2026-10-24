import { describe, expect, it } from "vitest";
import { calculatePrice, checkPromotion, PricingError, selectRule, type PricingRuleInput, type PromotionInput } from "./engine";

const baseRule: PricingRuleInput = {
  id: "global",
  productType: null,
  countryId: null,
  destinationId: null,
  serviceId: null,
  productId: null,
  markupPercent: "25",
  markupFixed: "0",
  minProfit: null,
  currency: "USD",
  priority: 0,
  isActive: true,
};

const ctx = { productType: "ESIM" as const, productId: "p1", countryId: "c1", destinationId: "d1", serviceId: null };

describe("selectRule", () => {
  it("prefers the most specific matching rule", () => {
    const rules: PricingRuleInput[] = [
      baseRule,
      { ...baseRule, id: "esim", productType: "ESIM" },
      { ...baseRule, id: "country", countryId: "c1" },
      { ...baseRule, id: "product", productId: "p1" },
    ];
    expect(selectRule(rules, ctx)?.id).toBe("product");
    expect(selectRule(rules.slice(0, 3), ctx)?.id).toBe("country");
    expect(selectRule(rules.slice(0, 2), ctx)?.id).toBe("esim");
  });

  it("ignores inactive and non-matching rules", () => {
    const rules: PricingRuleInput[] = [
      { ...baseRule, id: "inactive", productId: "p1", isActive: false },
      { ...baseRule, id: "other-country", countryId: "c2" },
      { ...baseRule, id: "verification", productType: "VERIFICATION" },
    ];
    expect(selectRule(rules, ctx)).toBeNull();
  });

  it("breaks ties on priority", () => {
    const rules: PricingRuleInput[] = [
      { ...baseRule, id: "low", priority: 1 },
      { ...baseRule, id: "high", priority: 5 },
    ];
    expect(selectRule(rules, ctx)?.id).toBe("high");
  });
});

describe("calculatePrice", () => {
  it("applies percentage markup and rounds up to the minor unit", () => {
    const b = calculatePrice({ supplierCost: "1.99", supplierCurrency: "USD", currency: "USD", exchangeRate: null, rule: baseRule });
    // 1.99 * 1.25 = 2.4875 → 2.49
    expect(b.unitPrice).toBe("2.49");
    expect(b.convertedCost).toBe("1.99");
    expect(b.grossProfit).toBe("0.5");
  });

  it("combines percentage and fixed markups", () => {
    const rule = { ...baseRule, markupPercent: "10", markupFixed: "0.5" };
    const b = calculatePrice({ supplierCost: "10", supplierCurrency: "USD", currency: "USD", exchangeRate: null, rule });
    expect(b.unitPrice).toBe("11.5");
  });

  it("enforces the minimum profit floor", () => {
    const rule = { ...baseRule, markupPercent: "5", minProfit: "1.00" };
    const b = calculatePrice({ supplierCost: "2", supplierCurrency: "USD", currency: "USD", exchangeRate: null, rule });
    expect(b.unitPrice).toBe("3");
    expect(b.minProfitApplied).toBe(true);
  });

  it("converts supplier cost with an explicit exchange rate", () => {
    const b = calculatePrice({
      supplierCost: "10",
      supplierCurrency: "USD",
      currency: "GHS",
      exchangeRate: "15.5",
      rule: { ...baseRule, currency: "GHS" },
    });
    expect(b.convertedCost).toBe("155");
    expect(b.unitPrice).toBe("193.75");
    expect(b.exchangeRate).toBe("15.5");
  });

  it("refuses to price when currencies differ and no rate exists", () => {
    expect(() =>
      calculatePrice({ supplierCost: "10", supplierCurrency: "USD", currency: "GHS", exchangeRate: null, rule: { ...baseRule, currency: "GHS" } }),
    ).toThrow(PricingError);
  });

  it("refuses to price without a rule or with a rule in another currency", () => {
    expect(() => calculatePrice({ supplierCost: "1", supplierCurrency: "USD", currency: "USD", exchangeRate: null, rule: null })).toThrow(
      /No active pricing rule/,
    );
    expect(() =>
      calculatePrice({ supplierCost: "1", supplierCurrency: "USD", currency: "USD", exchangeRate: null, rule: { ...baseRule, currency: "EUR" } }),
    ).toThrow(PricingError);
  });

  it("never prices below cost even with a negative markup", () => {
    const b = calculatePrice({
      supplierCost: "5",
      supplierCurrency: "USD",
      currency: "USD",
      exchangeRate: null,
      rule: { ...baseRule, markupPercent: "-50" },
    });
    expect(b.unitPrice).toBe("5");
  });

  it("uses currency-specific minor units (JPY has none)", () => {
    const b = calculatePrice({
      supplierCost: "100",
      supplierCurrency: "JPY",
      currency: "JPY",
      exchangeRate: null,
      rule: { ...baseRule, currency: "JPY", markupPercent: "33" },
    });
    expect(b.unitPrice).toBe("133");
  });

  it("avoids floating point drift", () => {
    const b = calculatePrice({
      supplierCost: "0.1",
      supplierCurrency: "USD",
      currency: "USD",
      exchangeRate: null,
      rule: { ...baseRule, markupPercent: "0", markupFixed: "0.2" },
    });
    expect(b.unitPrice).toBe("0.3");
  });
});

describe("promotions", () => {
  const promo: PromotionInput = {
    id: "promo",
    code: "WELCOME10",
    percentOff: "10",
    amountOff: null,
    currency: null,
    productType: null,
    minOrderAmount: null,
    maxRedemptions: null,
    redemptionCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
  };
  const now = new Date("2026-10-01T00:00:00Z");
  const input = { productType: "ESIM" as const, listPrice: "5", currency: "USD", now };

  it("applies a percentage discount rounded down", () => {
    const b = calculatePrice({ supplierCost: "8", supplierCurrency: "USD", currency: "USD", exchangeRate: null, rule: baseRule, promotion: promo });
    expect(b.listPrice).toBe("10");
    expect(b.discount).toBe("1");
    expect(b.unitPrice).toBe("9");
    expect(b.promotionId).toBe("promo");
  });

  it("caps discounts so the price never goes below cost", () => {
    const big = { ...promo, percentOff: null, amountOff: "50", currency: "USD" };
    const b = calculatePrice({ supplierCost: "8", supplierCurrency: "USD", currency: "USD", exchangeRate: null, rule: baseRule, promotion: big });
    expect(b.unitPrice).toBe("8");
    expect(b.discount).toBe("2");
  });

  it("validates promotion eligibility", () => {
    expect(checkPromotion(promo, input)).toBeNull();
    expect(checkPromotion({ ...promo, isActive: false }, input)).toBe("inactive");
    expect(checkPromotion({ ...promo, endsAt: new Date("2026-09-01") }, input)).toBe("expired");
    expect(checkPromotion({ ...promo, startsAt: new Date("2026-11-01") }, input)).toBe("not_started");
    expect(checkPromotion({ ...promo, maxRedemptions: 3, redemptionCount: 3 }, input)).toBe("exhausted");
    expect(checkPromotion({ ...promo, productType: "RENTAL" }, input)).toBe("wrong_product");
    expect(checkPromotion({ ...promo, minOrderAmount: "10", currency: "USD" }, input)).toBe("below_minimum");
    expect(checkPromotion({ ...promo, amountOff: "1", percentOff: null, currency: "EUR" }, input)).toBe("currency_mismatch");
  });
});
