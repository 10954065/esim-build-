import { describe, expect, it } from "vitest";
import { calculatePrice, checkPromotion, priceWithRules, PricingError, selectRule, type PricingContext, type PricingRuleInput, type PromotionInput } from "./engine";

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
  fixedPrice: null,
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

describe("fixed price rules", () => {
  const RATE = "11.643541"; // GHS per USD
  const defaultGhs: PricingRuleInput = { ...baseRule, id: "default", markupPercent: "50", minProfit: "20", currency: "GHS" };
  const flatCodes: PricingRuleInput = {
    ...baseRule,
    id: "flat-codes",
    productType: "VERIFICATION",
    markupPercent: "0",
    minProfit: "2",
    fixedPrice: "14",
    currency: "GHS",
  };
  const codeCtx = { productType: "VERIFICATION" as const, productId: "v1", countryId: "c1", destinationId: null, serviceId: "s1" };
  const priced = (supplierCost: string, context: PricingContext = codeCtx) =>
    priceWithRules([defaultGhs, flatCodes], context, { supplierCost, supplierCurrency: "USD", currency: "GHS", exchangeRate: RATE });

  it("sells at exactly the fixed price and records it in the breakdown", () => {
    const b = calculatePrice({ supplierCost: "0.50", supplierCurrency: "USD", currency: "GHS", exchangeRate: RATE, rule: flatCodes });
    expect(b.unitPrice).toBe("14");
    expect(b.fixedPrice).toBe("14");
    expect(b.minProfitApplied).toBe(false);
    expect(b.grossProfit).toBe("8.1782295");
  });

  it("refuses a fixed price that would not leave the rule's minimum profit", () => {
    // $1.10 = GHS 12.81; 12.81 + 2 > 14
    expect(() => calculatePrice({ supplierCost: "1.10", supplierCurrency: "USD", currency: "GHS", exchangeRate: RATE, rule: flatCodes })).toThrow(
      expect.objectContaining({ code: "FIXED_PRICE_TOO_LOW" }),
    );
  });

  it("uses the flat price for cheap codes", () => {
    expect(priced("0.50")).toMatchObject({ ruleId: "flat-codes", unitPrice: "14" });
    expect(priced("1.03")).toMatchObject({ ruleId: "flat-codes", unitPrice: "14" });
  });

  it("falls back to the next matching rule when a code costs too much for the flat price", () => {
    // $1.10 = GHS 12.81 → default rule: max(12.81 × 1.5, 12.81 + 20) = 32.81
    expect(priced("1.10")).toMatchObject({ ruleId: "default", unitPrice: "32.81", fixedPrice: null });
  });

  it("never applies a verification flat price to eSIMs", () => {
    expect(priced("0.50", ctx)).toMatchObject({ ruleId: "default" });
  });

  it("reports NO_RULE when only an unaffordable fixed price rule matches", () => {
    expect(() =>
      priceWithRules([flatCodes], codeCtx, { supplierCost: "5", supplierCurrency: "USD", currency: "GHS", exchangeRate: RATE }),
    ).toThrow(expect.objectContaining({ code: "NO_RULE" }));
  });
});
