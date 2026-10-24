import type { z } from "zod";
import type {
  ActivationInfo,
  ActivationState,
  DestinationKind,
  EsimDestinationInfo,
  EsimLifecycle,
  EsimOrderInfo,
  EsimPackageInfo,
  RentalInfo,
  RentalState,
  RentalTermPrice,
  SmsMessageInfo,
  VerificationOffer,
} from "../types";
import {
  activationCheckSchema,
  activationOrderSchema,
  destinationSchema,
  esimOrderSchema,
  numberSchema,
  operatorSchema,
  packageSchema,
  smsMessageSchema,
  termPriceSchema,
} from "./schemas";

/** Pure mapping functions from documented 1001SMS shapes to normalized models. */

export function mapDestinationKind(kind: string): DestinationKind {
  const k = kind.toLowerCase();
  if (k === "country") return "COUNTRY";
  if (k === "global" || k === "worldwide") return "GLOBAL";
  return "REGION";
}

export function mapDestination(d: z.output<typeof destinationSchema>): EsimDestinationInfo {
  return {
    locationCode: d.locationCode,
    name: d.name,
    kind: mapDestinationKind(d.kind),
    packageCount: d.packageCount,
    fromCost: d.fromPrice ?? null,
    topSpeed: d.topSpeed ?? null,
  };
}

export function mapPackage(p: z.output<typeof packageSchema>): EsimPackageInfo {
  return {
    packageCode: p.packageCode,
    name: p.name,
    locationCode: p.locationCode,
    locationName: p.locationName,
    dataLabel: p.volumeLabel ?? null,
    volumeBytes: p.volumeBytes,
    durationDays: p.durationDays ?? null,
    speed: p.speed ?? null,
    cost: p.price,
    unlimited: p.unlimited,
    pricingUnit: p.pricingUnit ?? null,
    fupPolicy: p.fupPolicy ?? null,
    ipExport: p.ipExport ?? null,
    // 1001SMS packages are data plans. The documented package fields contain no phone
    // number, SMS or voice capability, so these remain false.
    includesPhoneNumber: false,
    includesSms: false,
    includesVoice: false,
  };
}

const LIFECYCLES: Record<string, EsimLifecycle> = {
  preparing: "PREPARING",
  ready: "READY",
  active: "ACTIVE",
  expired: "EXPIRED",
  failed: "FAILED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  refunded: "REFUNDED",
};

export function mapEsimOrder(o: z.output<typeof esimOrderSchema>): EsimOrderInfo {
  return {
    supplierOrderId: o.id,
    packageCode: o.packageCode,
    status: o.status,
    lifecycle: LIFECYCLES[o.lifecycle.toLowerCase()] ?? "PREPARING",
    ready: o.ready,
    cost: o.price,
    createdAt: o.createdAt ? new Date(o.createdAt) : null,
    profiles: o.profiles.map((p) => ({
      supplierProfileId: p.id,
      iccid: p.iccid ?? null,
      activationCode: p.activationCode ?? null,
      qrCodeUrl: p.qrCodeUrl ?? null,
      apn: p.apn ?? null,
      status: p.status ?? null,
      smdpStatus: p.smdpStatus ?? null,
      totalVolumeBytes: p.totalVolume,
      usedVolumeBytes: p.usedVolume,
      activatedAt: p.activatedAt,
      expiresAt: p.expiresAt,
    })),
  };
}

export function mapOffer(
  countryCode: string,
  serviceSlug: string,
  serviceName: string,
  op: z.output<typeof operatorSchema>,
): VerificationOffer {
  return {
    countryCode: countryCode.toUpperCase(),
    serviceSlug,
    serviceName,
    providerTier: op.provider,
    operator: op.operator,
    cost: op.price,
    stock: op.count,
    deliverability: op.deliverability ?? null,
  };
}

export function mapMessage(m: z.output<typeof smsMessageSchema>): SmsMessageInfo {
  return {
    supplierMessageId: m.id,
    sender: m.sender ?? null,
    // Activations return the body as `message`; virtual numbers as `text`.
    text: m.text ?? m.message ?? "",
    code: m.code ?? null,
    receivedAt: new Date(m.receivedAt),
  };
}

export function mapActivationState(status: string, hasMessages: boolean): ActivationState {
  switch (status.toUpperCase()) {
    case "COMPLETED":
      return "COMPLETED";
    case "EXPIRED":
      return "EXPIRED";
    case "REFUNDED":
      return "REFUNDED";
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED";
    case "BLOCKED":
      return "BLOCKED";
    default:
      // RENTED / PENDING / ACTIVE — still waiting unless a message has arrived.
      return hasMessages ? "RECEIVED" : "WAITING";
  }
}

export function mapActivation(o: z.output<typeof activationOrderSchema>, fallbackCountry?: string): ActivationInfo {
  const messages = (o.messages ?? []).map(mapMessage);
  return {
    supplierOrderId: o.id,
    phoneNumber: o.phoneNumber,
    countryCode: (o.countryCode ?? fallbackCountry ?? "").toUpperCase(),
    serviceSlug: o.serviceId ?? "",
    serviceName: o.serviceName ?? o.serviceId ?? "",
    operator: o.operatorName ?? null,
    providerTier: o.provider ?? null,
    cost: o.price,
    state: mapActivationState(o.status, messages.length > 0),
    supplierStatus: o.status,
    expiresAt: new Date(o.expiresAt),
    createdAt: o.rentedAt ? new Date(o.rentedAt) : null,
    messages,
  };
}

export function mergeActivationCheck(base: ActivationInfo, check: z.output<typeof activationCheckSchema>): ActivationInfo {
  const messages = check.messages.map(mapMessage);
  return {
    ...base,
    messages,
    supplierStatus: check.status,
    state: mapActivationState(check.status, messages.length > 0 || check.hasMessage),
  };
}

export function mapRentalState(status: string): RentalState {
  switch (status.toUpperCase()) {
    case "EXPIRED":
      return "EXPIRED";
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED";
    case "REFUNDED":
      return "REFUNDED";
    default:
      return "ACTIVE";
  }
}

export function mapRental(n: z.output<typeof numberSchema>): RentalInfo {
  return {
    supplierNumberId: n.id,
    phoneNumber: n.phoneNumber,
    countryCode: n.country.toUpperCase(),
    rentalType: n.type,
    serviceSlug: n.service ?? null,
    serviceName: n.serviceName ?? null,
    term: n.term,
    state: mapRentalState(n.status),
    supplierStatus: n.status,
    cost: n.price,
    rentedAt: new Date(n.rentedAt),
    expiresAt: new Date(n.expiresAt),
    messages: (n.messages ?? []).map(mapMessage),
  };
}

export function mapTermPrice(t: z.output<typeof termPriceSchema>): RentalTermPrice {
  return { term: t.term, days: t.days ?? null, hours: t.hours ?? null, cost: t.price };
}

/** Service-type term entries are not fully documented; keep only well-formed ones. */
export function mapUnknownTerms(terms: unknown[]): RentalTermPrice[] {
  const out: RentalTermPrice[] = [];
  for (const t of terms) {
    const parsed = termPriceSchema.safeParse(t);
    if (parsed.success) out.push(mapTermPrice(parsed.data));
  }
  return out;
}
