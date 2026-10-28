import { dec, roundDownToMinor, roundUpToMinor, type DecimalInput } from "./money";

/**
 * Pure pricing engine. No I/O. Every input that affects price is passed in explicitly
 * and echoed in the breakdown so orders can store an exact pricing snapshot.
 *
 * price = round_up( max( cost·rate·(1 + pct/100) + fixed , cost·rate + minProfit ) )
 *         − promotion discount (never below converted cost)
 */

export type ProductKind = "ESIM" | "VERIFICATION" | "RENTAL";

export interface PricingRuleInput {
  id: string;
  productType: ProductKind | null;
  countryId: string | null;
  destinationId: string | null;
  serviceId: string | null;
  productId: string | null;
  markupPercent: DecimalInput;
  markupFixed: DecimalInput;
  minProfit: DecimalInput | null;
  /** Sell at exactly this price; the rule steps aside when it would not leave minProfit. */
  fixedPrice: DecimalInput | null;
  currency: string;
  priority: number;
  isActive: boolean;
}

export interface PricingContext {
  productType: ProductKind;
  productId: string;
  countryId: string | null;
  destinationId: string | null;
  serviceId: string | null;
}

export interface PromotionInput {
  id: string;
  code: string;
  percentOff: DecimalInput | null;
  amountOff: DecimalInput | null;
  currency: string | null;
  productType: ProductKind | null;
  minOrderAmount: DecimalInput | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export type PricingErrorCode = "NO_RULE" | "NO_RATE" | "RULE_CURRENCY_MISMATCH" | "INVALID_COST" | "FIXED_PRICE_TOO_LOW";

export class PricingError extends Error {
  constructor(
    readonly code: PricingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PricingError";
  }
}

export interface PriceBreakdown {
  currency: string;
  supplierCost: string;
  supplierCurrency: string;
  exchangeRate: string | null;
  convertedCost: string;
  ruleId: string;
  markupPercent: string;
  markupFixed: string;
  minProfit: string | null;
  minProfitApplied: boolean;
  fixedPrice: string | null;
  listPrice: string;
  promotionId: string | null;
  discount: string;
  unitPrice: string;
  grossProfit: string;
}

/** Specificity score of a rule; -1 when it does not match the context. */
export function ruleSpecificity(rule: PricingRuleInput, ctx: PricingContext): number {
  if (!rule.isActive) return -1;
  if (rule.productId && rule.productId !== ctx.productId) return -1;
  if (rule.productType && rule.productType !== ctx.productType) return -1;
  if (rule.serviceId && rule.serviceId !== ctx.serviceId) return -1;
  if (rule.countryId && rule.countryId !== ctx.countryId) return -1;
  if (rule.destinationId && rule.destinationId !== ctx.destinationId) return -1;

  if (rule.productId) return 100;
  if (rule.serviceId && (rule.countryId || rule.destinationId)) return 60;
  if (rule.serviceId) return 50;
  if (rule.destinationId) return 45;
  if (rule.countryId) return 40;
  if (rule.productType) return 10;
  return 0;
}

/** Matching rules, best first: most specific, then highest priority, then list order. */
export function rankRules(rules: readonly PricingRuleInput[], ctx: PricingContext): PricingRuleInput[] {
  return rules
    .map((rule, index) => ({ rule, index, score: ruleSpecificity(rule, ctx) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score || b.rule.priority - a.rule.priority || a.index - b.index)
    .map((r) => r.rule);
}

export function selectRule(rules: readonly PricingRuleInput[], ctx: PricingContext): PricingRuleInput | null {
  return rankRules(rules, ctx)[0] ?? null;
}

/**
 * Prices with the best matching rule. A fixed price rule that would not cover cost plus its
 * minimum profit steps aside for the next matching rule, so a flat price never sells at a loss.
 */
export function priceWithRules(
  rules: readonly PricingRuleInput[],
  ctx: PricingContext,
  input: Omit<CalculatePriceInput, "rule">,
): PriceBreakdown {
  for (const rule of rankRules(rules, ctx)) {
    try {
      return calculatePrice({ ...input, rule });
    } catch (err) {
      if (err instanceof PricingError && err.code === "FIXED_PRICE_TOO_LOW") continue;
      throw err;
    }
  }
  throw new PricingError("NO_RULE", "No active pricing rule applies to this product");
}

export type PromotionRejection =
  | "inactive"
  | "not_started"
  | "expired"
  | "exhausted"
  | "wrong_product"
  | "below_minimum"
  | "currency_mismatch";

export function checkPromotion(
  promo: PromotionInput,
  input: { productType: ProductKind; listPrice: DecimalInput; currency: string; now: Date },
): PromotionRejection | null {
  if (!promo.isActive) return "inactive";
  if (promo.startsAt && input.now < promo.startsAt) return "not_started";
  if (promo.endsAt && input.now > promo.endsAt) return "expired";
  if (promo.maxRedemptions !== null && promo.redemptionCount >= promo.maxRedemptions) return "exhausted";
  if (promo.productType && promo.productType !== input.productType) return "wrong_product";
  if ((promo.amountOff !== null || promo.minOrderAmount !== null) && promo.currency && promo.currency !== input.currency) {
    return "currency_mismatch";
  }
  if (promo.minOrderAmount !== null && dec(input.listPrice).lt(dec(promo.minOrderAmount))) return "below_minimum";
  return null;
}

export interface CalculatePriceInput {
  supplierCost: DecimalInput;
  supplierCurrency: string;
  currency: string;
  /** Units of `currency` per 1 unit of `supplierCurrency`. Required when currencies differ. */
  exchangeRate: DecimalInput | null;
  rule: PricingRuleInput | null;
  promotion?: PromotionInput | null;
}

export function calculatePrice(input: CalculatePriceInput): PriceBreakdown {
  const { supplierCurrency, currency, rule } = input;
  const cost = dec(input.supplierCost);
  if (!cost.isFinite() || cost.isNegative()) throw new PricingError("INVALID_COST", "Supplier cost must be zero or more");
  if (!rule) throw new PricingError("NO_RULE", "No active pricing rule applies to this product");
  if (rule.currency.toUpperCase() !== currency.toUpperCase()) {
    throw new PricingError("RULE_CURRENCY_MISMATCH", `Pricing rule ${rule.id} is in ${rule.currency}, checkout is in ${currency}`);
  }

  const sameCurrency = supplierCurrency.toUpperCase() === currency.toUpperCase();
  if (!sameCurrency && (input.exchangeRate === null || dec(input.exchangeRate).lte(0))) {
    throw new PricingError("NO_RATE", `No valid exchange rate for ${supplierCurrency}→${currency}`);
  }
  const rate = sameCurrency ? null : dec(input.exchangeRate!);
  const convertedCost = rate ? cost.times(rate) : cost;

  const pct = dec(rule.markupPercent);
  const fixed = dec(rule.markupFixed);
  let price = convertedCost.times(dec(1).plus(pct.div(100))).plus(fixed);

  let minProfitApplied = false;
  if (rule.fixedPrice !== null) {
    price = dec(rule.fixedPrice);
    if (price.lt(convertedCost.plus(dec(rule.minProfit ?? 0)))) {
      throw new PricingError("FIXED_PRICE_TOO_LOW", `Fixed price ${price} ${currency} does not cover cost plus minimum profit`);
    }
  } else if (rule.minProfit !== null) {
    const floor = convertedCost.plus(dec(rule.minProfit));
    if (price.lt(floor)) {
      price = floor;
      minProfitApplied = true;
    }
  }

  // Never sell below cost, even with misconfigured negative markups.
  const costFloor = roundUpToMinor(convertedCost, currency);
  const listPrice = Decimal_max(roundUpToMinor(price, currency), costFloor);

  let discount = dec(0);
  let promotionId: string | null = null;
  if (input.promotion) {
    const promo = input.promotion;
    if (promo.percentOff !== null) discount = listPrice.times(dec(promo.percentOff)).div(100);
    else if (promo.amountOff !== null) discount = dec(promo.amountOff);
    discount = roundDownToMinor(discount, currency);
    const maxDiscount = listPrice.minus(costFloor);
    if (discount.gt(maxDiscount)) discount = maxDiscount;
    if (discount.isNegative()) discount = dec(0);
    promotionId = discount.gt(0) ? promo.id : null;
  }

  const unitPrice = listPrice.minus(discount);

  return {
    currency,
    supplierCost: cost.toString(),
    supplierCurrency,
    exchangeRate: rate ? rate.toString() : null,
    convertedCost: convertedCost.toString(),
    ruleId: rule.id,
    markupPercent: pct.toString(),
    markupFixed: fixed.toString(),
    minProfit: rule.minProfit === null ? null : dec(rule.minProfit).toString(),
    minProfitApplied,
    fixedPrice: rule.fixedPrice === null ? null : dec(rule.fixedPrice).toString(),
    listPrice: listPrice.toString(),
    promotionId,
    discount: discount.toString(),
    unitPrice: unitPrice.toString(),
    grossProfit: unitPrice.minus(convertedCost).toString(),
  };
}

function Decimal_max(a: ReturnType<typeof dec>, b: ReturnType<typeof dec>) {
  return a.gte(b) ? a : b;
}
