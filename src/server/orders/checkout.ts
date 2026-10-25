import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { humanReference, randomToken } from "@/server/crypto";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { createPricingSession, findPromotion, checkPromotion, PROMOTION_MESSAGES, PricingError } from "@/server/pricing/service";
import { dec, toDbAmount, toMinorUnits } from "@/server/pricing/money";
import type { PriceBreakdown } from "@/server/pricing/engine";
import { getPaymentGateway, PaymentGatewayError } from "@/server/providers/payment";
import { getSupplierAdapter, isSupplierError } from "@/server/providers/supplier";
import { consumeRateLimit } from "@/server/rate-limit";
import { getSetting } from "@/server/settings";
import type { ItemConfiguration } from "./configuration";
import { transitionOrder } from "./service";

/**
 * Checkout: live re-validation with the supplier, server-side pricing, idempotent order
 * creation, then gateway initialisation outside any database transaction.
 */

const log = logger.child({ component: "checkout" });

const productInclude = {
  supplier: true,
  destination: { include: { country: true } },
  country: true,
  service: true,
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export interface CheckoutQuote {
  productId: string;
  productType: ProductRow["type"];
  title: string;
  subtitle: string;
  /** Flag to show next to the title (regional/global eSIMs have no single country). */
  flag: { code: string | null; kind: "COUNTRY" | "REGION" | "GLOBAL" };
  perDay: boolean;
  quantity: number;
  currency: string;
  unitPrice: string;
  listUnitPrice: string;
  discountTotal: string;
  total: string;
  supplierUnitCost: string;
  supplierCurrency: string;
  breakdown: PriceBreakdown;
  configuration: ItemConfiguration;
  promotionId: string | null;
  promoMessage: string | null;
  isSandbox: boolean;
}

export type QuoteResult = { ok: true; quote: CheckoutQuote } | { ok: false; reason: string };

function describe(p: ProductRow): { title: string; subtitle: string } {
  if (p.type === "ESIM") return { title: p.name, subtitle: `${p.destination?.name ?? "Travel"} eSIM · data only` };
  if (p.type === "VERIFICATION") return { title: `${p.service?.name ?? "Service"} verification number`, subtitle: `${p.country?.name ?? ""} · one-time activation` };
  return { title: p.name, subtitle: `${p.country?.name ?? ""} · rental, never auto-renews` };
}

function flagOf(p: ProductRow): CheckoutQuote["flag"] {
  if (p.destination) return { code: p.destination.country?.code ?? null, kind: p.destination.kind };
  return { code: p.country?.code ?? null, kind: "COUNTRY" };
}

/** Re-check availability and cost with the supplier; updates the stored product. */
async function refreshFromSupplier(p: ProductRow): Promise<{ cost: string; config: ItemConfiguration } | { unavailable: string }> {
  const adapter = getSupplierAdapter();
  if (p.supplier.code !== adapter.code) return { unavailable: "This product belongs to a supplier that is not active." };

  if (p.type === "ESIM") {
    if (!p.destination) return { unavailable: "Destination unavailable." };
    const pkg = (await adapter.esim.listPackages(p.destination.locationCode)).find((x) => x.packageCode === p.supplierProductCode);
    if (!pkg) {
      await db.product.update({ where: { id: p.id }, data: { isActive: false } });
      return { unavailable: "This plan is no longer offered by our supplier." };
    }
    await db.product.update({ where: { id: p.id }, data: { wholesaleCost: toDbAmount(pkg.cost), lastSyncedAt: new Date() } });
    return { cost: pkg.cost, config: { kind: "ESIM", packageCode: pkg.packageCode, locationCode: p.destination.locationCode } };
  }

  if (p.type === "VERIFICATION") {
    if (!p.country || !p.service || !p.providerTier || !p.operator) return { unavailable: "Offer unavailable." };
    const offer = (await adapter.verification.getOffers({ countryCode: p.country.code, serviceSlug: p.service.slug })).find(
      (o) => o.providerTier === p.providerTier && o.operator === p.operator,
    );
    if (!offer || offer.stock <= 0) {
      await db.product.update({ where: { id: p.id }, data: { isActive: false, stockCount: 0 } });
      return { unavailable: "No numbers are available on this route right now. Try another route." };
    }
    await db.product.update({ where: { id: p.id }, data: { wholesaleCost: toDbAmount(offer.cost), stockCount: offer.stock, lastSyncedAt: new Date() } });
    return {
      cost: offer.cost,
      config: { kind: "VERIFICATION", countryCode: p.country.code, serviceSlug: p.service.slug, serviceName: p.service.name, providerTier: offer.providerTier, operator: offer.operator },
    };
  }

  if (!p.country || !p.rentalTerm || !p.rentalType) return { unavailable: "Rental unavailable." };
  const pricing = await adapter.rentals.getRentalPricing(p.country.code);
  const list = p.rentalType === "service" ? pricing.services.find((s) => s.serviceSlug === p.service?.slug)?.terms : pricing.unlimited;
  const term = list?.find((t) => t.term === p.rentalTerm);
  if (!term) return { unavailable: "This rental term is no longer offered." };
  if (p.rentalType === "unlimited") {
    const avail = await adapter.rentals.getRentalAvailability(p.country.code, p.rentalTerm);
    if (!avail.inStock) return { unavailable: "No rental numbers are in stock for this term right now." };
  }
  await db.product.update({ where: { id: p.id }, data: { wholesaleCost: toDbAmount(term.cost), lastSyncedAt: new Date() } });
  return { cost: term.cost, config: { kind: "RENTAL", countryCode: p.country.code, term: term.term, rentalType: p.rentalType, serviceSlug: p.service?.slug } };
}

export async function quoteProduct(input: { productId: string; days?: number; promoCode?: string }): Promise<QuoteResult> {
  const product = await db.product.findFirst({ where: { id: input.productId, isActive: true, isVisible: true }, include: productInclude });
  if (!product || !product.supplier.isActive) return { ok: false, reason: "This product is not available." };
  if (product.destination && !product.destination.isEnabled) return { ok: false, reason: "This destination is not available." };
  if (product.country && !product.country.isEnabled) return { ok: false, reason: "This country is not available." };
  if (product.service && !product.service.isEnabled) return { ok: false, reason: "This service is not available." };

  let refreshed;
  try {
    refreshed = await refreshFromSupplier(product);
  } catch (err) {
    log.warn("supplier re-validation failed", { productId: product.id, err });
    return { ok: false, reason: isSupplierError(err) && err.kind === "RATE_LIMITED" ? "Our supplier is busy. Please try again in a minute." : "We could not confirm availability with our supplier. Please try again shortly." };
  }
  if ("unavailable" in refreshed) return { ok: false, reason: refreshed.unavailable };

  const perDay = product.type === "ESIM" && product.pricingUnit === "per_day";
  const quantity = perDay ? Math.min(365, Math.max(1, Math.floor(input.days ?? 1))) : 1;
  const config: ItemConfiguration = refreshed.config.kind === "ESIM" && perDay ? { ...refreshed.config, days: quantity } : refreshed.config;

  const session = await createPricingSession([product.wholesaleCurrency]);
  const priceable = { ...product, wholesaleCost: refreshed.cost };
  let base: PriceBreakdown;
  try {
    base = session.price(priceable);
  } catch (err) {
    if (err instanceof PricingError) return { ok: false, reason: "This product cannot be priced right now." };
    throw err;
  }

  let promoMessage: string | null = null;
  let breakdown = base;
  if (input.promoCode?.trim()) {
    const promo = await findPromotion(input.promoCode);
    if (!promo) promoMessage = "That promotion code was not found.";
    else {
      const rejection = checkPromotion(promo, { productType: product.type, listPrice: dec(base.listPrice).times(quantity).toString(), currency: session.currency, now: new Date() });
      if (rejection) promoMessage = PROMOTION_MESSAGES[rejection];
      else breakdown = session.price(priceable, promo);
    }
  }

  const { title, subtitle } = describe(product);
  const unit = dec(breakdown.unitPrice);
  return {
    ok: true,
    quote: {
      productId: product.id,
      productType: product.type,
      title,
      subtitle,
      flag: flagOf(product),
      perDay,
      quantity,
      currency: session.currency,
      unitPrice: unit.toString(),
      listUnitPrice: breakdown.listPrice,
      discountTotal: dec(breakdown.discount).times(quantity).toString(),
      total: unit.times(quantity).toString(),
      supplierUnitCost: refreshed.cost,
      supplierCurrency: product.wholesaleCurrency,
      breakdown,
      configuration: config,
      promotionId: breakdown.promotionId,
      promoMessage,
      isSandbox: product.supplier.mode === "SANDBOX",
    },
  };
}

export type CheckoutResult = { ok: true; orderId: string; authorizationUrl: string } | { ok: false; error: string };

export async function createCheckout(input: {
  userId: string;
  email: string;
  productId: string;
  days?: number;
  promoCode?: string;
  idempotencyKey: string;
}): Promise<CheckoutResult> {
  const env = getEnv();
  if (env.PAYMENT_PROVIDER === "disabled" || env.SUPPLIER_MODE === "disabled") return { ok: false, error: "Purchases are not available right now." };
  if (!(await getSetting("store.purchasesEnabled"))) return { ok: false, error: "New purchases are temporarily paused." };

  // Idempotent re-submission of the same checkout returns the existing payment page.
  const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { payments: true } });
  if (existing) {
    if (existing.userId !== input.userId) return { ok: false, error: "Invalid checkout session." };
    const url = existing.payments.find((p) => p.authorizationUrl && p.status === "INITIALIZED")?.authorizationUrl;
    if (existing.status === "AWAITING_PAYMENT" && url) return { ok: true, orderId: existing.id, authorizationUrl: url };
    return { ok: false, error: "This checkout was already used. Please start again." };
  }

  const rl = await consumeRateLimit(`checkout:${input.userId}`, 10, 600);
  if (!rl.ok) return { ok: false, error: "Too many checkout attempts. Please wait a few minutes." };
  const dailyLimit = await getSetting("limits.maxOrdersPerUserPerDay");
  const today = await db.order.count({ where: { userId: input.userId, createdAt: { gt: new Date(Date.now() - 86400000) }, status: { notIn: ["CANCELLED", "CREATED"] } } });
  if (today >= dailyLimit) return { ok: false, error: "You have reached the daily purchase limit. Please contact support if you need more." };

  const quoteResult = await quoteProduct({ productId: input.productId, days: input.days, promoCode: input.promoCode });
  if (!quoteResult.ok) return { ok: false, error: quoteResult.reason };
  const q = quoteResult.quote;

  if (q.productType === "VERIFICATION") {
    const maxActive = await getSetting("limits.maxActiveVerificationsPerUser");
    const active = await db.verificationActivation.count({ where: { userId: input.userId, status: { in: ["WAITING", "RECEIVED"] }, expiresAt: { gt: new Date() } } });
    if (active >= maxActive) return { ok: false, error: `You can have at most ${maxActive} active verification numbers at a time.` };
  }

  const gateway = getPaymentGateway();
  if (gateway.isSandbox !== q.isSandbox) return { ok: false, error: "Payment and supplier modes do not match. Contact support." };

  const windowMinutes = await getSetting("orders.paymentWindowMinutes");
  const totalMinor = toMinorUnits(q.total, q.currency);
  if (totalMinor <= BigInt(0)) return { ok: false, error: "Invalid order total." };
  const supplierTotal = dec(q.supplierUnitCost).times(q.quantity);

  const created = await db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        number: humanReference("ORD"),
        userId: input.userId,
        status: "CREATED",
        currency: q.currency,
        subtotal: toDbAmount(dec(q.listUnitPrice).times(q.quantity)),
        discountTotal: toDbAmount(q.discountTotal),
        total: toDbAmount(q.total),
        supplierCostTotal: toDbAmount(supplierTotal),
        supplierCurrency: q.supplierCurrency,
        exchangeRateValue: q.breakdown.exchangeRate,
        promotionId: q.promotionId,
        isSandbox: q.isSandbox,
        idempotencyKey: input.idempotencyKey,
        expiresAt: new Date(Date.now() + windowMinutes * 60 * 1000),
        items: {
          create: {
            productId: q.productId,
            productType: q.productType,
            description: q.perDay ? `${q.title} × ${q.quantity} day${q.quantity === 1 ? "" : "s"}` : q.title,
            quantity: q.quantity,
            unitPrice: toDbAmount(q.unitPrice),
            total: toDbAmount(q.total),
            wholesaleCost: toDbAmount(supplierTotal),
            wholesaleCurrency: q.supplierCurrency,
            pricingSnapshot: q.breakdown as unknown as Prisma.InputJsonValue,
            configuration: q.configuration as unknown as Prisma.InputJsonValue,
          },
        },
        history: { create: { toStatus: "CREATED", actorType: "CUSTOMER", actorId: input.userId, reason: "Checkout started" } },
      },
    });
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        provider: gateway.code,
        reference: `${order.number}-${randomToken(6)}`.replace(/[^A-Za-z0-9-]/g, ""),
        amount: toDbAmount(q.total),
        currency: q.currency,
        amountMinor: totalMinor,
      },
    });
    return { order, payment };
  });

  try {
    const { authorizationUrl } = await gateway.initialize({
      reference: created.payment.reference,
      amountMinor: totalMinor,
      currency: q.currency,
      email: input.email,
      callbackUrl: `${env.APP_URL.replace(/\/$/, "")}/checkout/return?reference=${encodeURIComponent(created.payment.reference)}`,
      metadata: { orderId: created.order.id, orderNumber: created.order.number },
    });
    await db.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: created.payment.id }, data: { authorizationUrl } });
      await transitionOrder(tx, { orderId: created.order.id, from: "CREATED", to: "AWAITING_PAYMENT", reason: "Redirected to payment", actorType: "CUSTOMER", actorId: input.userId });
    });
    return { ok: true, orderId: created.order.id, authorizationUrl };
  } catch (err) {
    log.error("payment initialisation failed", { orderId: created.order.id, err });
    await db.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: created.payment.id }, data: { status: "FAILED", failureReason: "Could not start payment" } });
      await transitionOrder(tx, { orderId: created.order.id, from: "CREATED", to: "CANCELLED", reason: "Payment could not be started", actorType: "SYSTEM", extra: { cancelledAt: new Date() } });
    });
    return { ok: false, error: err instanceof PaymentGatewayError ? "The payment provider is unavailable. Please try again shortly." : "We could not start the payment. Please try again." };
  }
}
