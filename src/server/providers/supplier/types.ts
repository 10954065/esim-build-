/**
 * Supplier-agnostic provider contracts and normalized models.
 *
 * Adapters translate supplier JSON into these shapes. Nothing outside an adapter may
 * depend on a supplier's raw field names. Monetary values are decimal strings in the
 * supplier's price currency (never JS floats in business logic).
 */

export type DecimalString = string;

// ───────────── Catalogue ─────────────

export interface SupplierCountry {
  code: string; // ISO 3166-1 alpha-2, upper case
  name: string;
  slug: string;
  phoneCode: string | null;
  continent: string | null;
}

export interface SupplierService {
  slug: string;
  name: string;
  iconUrl: string | null;
  popular: boolean;
}

export interface VerificationOffer {
  countryCode: string;
  serviceSlug: string;
  serviceName: string;
  providerTier: string; // e.g. EXTRA, MAIN — required by the order call
  operator: string;
  cost: DecimalString;
  stock: number;
  deliverability: number | null; // percentage reported by supplier
}

export type DestinationKind = "COUNTRY" | "REGION" | "GLOBAL";

export interface EsimDestinationInfo {
  locationCode: string;
  name: string;
  kind: DestinationKind;
  packageCount: number;
  fromCost: DecimalString | null;
  topSpeed: string | null;
}

export interface EsimPackageInfo {
  packageCode: string;
  name: string;
  locationCode: string;
  locationName: string;
  dataLabel: string | null;
  volumeBytes: bigint | null;
  durationDays: number | null;
  speed: string | null;
  cost: DecimalString;
  unlimited: boolean;
  pricingUnit: string | null; // e.g. "per_day" for day passes
  fupPolicy: string | null;
  ipExport: string | null;
  /** Only true when the supplier explicitly reports these capabilities. */
  includesPhoneNumber: boolean;
  includesSms: boolean;
  includesVoice: boolean;
}

export interface RentalCountry {
  code: string;
  name: string;
  phoneCode: string | null;
  types: string[];
}

export interface RentalTermPrice {
  term: string; // 12h | 1d | 7d | 30d | 180d | 365d
  days: number | null;
  hours: number | null;
  cost: DecimalString;
}

export interface RentalPricing {
  countryCode: string;
  unlimited: RentalTermPrice[];
  services: Array<{ serviceSlug: string; serviceName: string; terms: RentalTermPrice[] }>;
}

// ───────────── Orders / issued products ─────────────

export type EsimLifecycle = "PREPARING" | "READY" | "ACTIVE" | "EXPIRED" | "FAILED" | "CANCELLED" | "REFUNDED";

export interface EsimProfileInfo {
  supplierProfileId: string;
  iccid: string | null;
  activationCode: string | null; // LPA string — sensitive
  qrCodeUrl: string | null; // supplier-hosted QR — sensitive
  apn: string | null;
  status: string | null;
  smdpStatus: string | null;
  totalVolumeBytes: bigint | null;
  usedVolumeBytes: bigint | null;
  activatedAt: Date | null;
  expiresAt: Date | null;
}

export interface EsimOrderInfo {
  supplierOrderId: string;
  packageCode: string;
  status: string;
  lifecycle: EsimLifecycle;
  ready: boolean;
  cost: DecimalString;
  createdAt: Date | null;
  profiles: EsimProfileInfo[];
}

export type ActivationState = "WAITING" | "RECEIVED" | "COMPLETED" | "EXPIRED" | "CANCELLED" | "REFUNDED" | "BLOCKED";

export interface SmsMessageInfo {
  supplierMessageId: string;
  sender: string | null;
  text: string;
  code: string | null;
  receivedAt: Date;
}

export interface ActivationInfo {
  supplierOrderId: string;
  phoneNumber: string;
  countryCode: string;
  serviceSlug: string;
  serviceName: string;
  operator: string | null;
  providerTier: string | null;
  cost: DecimalString;
  state: ActivationState;
  supplierStatus: string;
  expiresAt: Date;
  createdAt: Date | null;
  messages: SmsMessageInfo[];
}

export interface CancelResult {
  state: ActivationState;
  supplierStatus: string;
  refundAmount: DecimalString; // "0" when nothing was refunded
}

export type RentalState = "ACTIVE" | "EXPIRED" | "CANCELLED" | "REFUNDED";

export interface RentalInfo {
  supplierNumberId: string;
  phoneNumber: string;
  countryCode: string;
  rentalType: string;
  serviceSlug: string | null;
  serviceName: string | null;
  term: string;
  state: RentalState;
  supplierStatus: string;
  cost: DecimalString;
  rentedAt: Date;
  expiresAt: Date;
  messages: SmsMessageInfo[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SupplierBalance {
  balance: DecimalString;
}

// ───────────── Webhooks ─────────────

export type SupplierWebhookEvent =
  | {
      kind: "sms.received";
      eventId: string;
      createdAt: Date | null;
      product: "activation" | "rental";
      supplierRef: string;
      message: SmsMessageInfo;
    }
  | { kind: "esim.update"; eventId: string; createdAt: Date | null; event: string; order: EsimOrderInfo }
  | { kind: "number.update"; eventId: string; createdAt: Date | null; event: string; supplierNumberId: string }
  | { kind: "ping"; eventId: string; createdAt: Date | null }
  | { kind: "unsupported"; eventId: string; createdAt: Date | null; event: string };

// ───────────── Provider interfaces ─────────────

export interface EsimProvider {
  listDestinations(): Promise<EsimDestinationInfo[]>;
  listPackages(locationCode: string): Promise<EsimPackageInfo[]>;
  orderEsim(input: { packageCode: string; quantity: number; days?: number }): Promise<EsimOrderInfo>;
  getEsimOrder(supplierOrderId: string, opts?: { refresh?: boolean }): Promise<EsimOrderInfo>;
  listEsimOrders(page: number, limit: number): Promise<Paginated<EsimOrderInfo>>;
}

export interface VerificationNumberProvider {
  listCountries(): Promise<SupplierCountry[]>;
  listServices(): Promise<SupplierService[]>;
  getOffers(input: { countryCode: string; serviceSlug?: string }): Promise<VerificationOffer[]>;
  orderActivation(input: {
    countryCode: string;
    serviceSlug: string;
    providerTier: string;
    operator?: string;
  }): Promise<ActivationInfo>;
  getActivation(supplierOrderId: string): Promise<ActivationInfo>;
  cancelActivation(supplierOrderId: string): Promise<CancelResult>;
  listRecentActivations(page: number, limit: number): Promise<Paginated<ActivationInfo>>;
}

export interface RentalNumberProvider {
  listRentalCountries(): Promise<RentalCountry[]>;
  getRentalPricing(countryCode: string): Promise<RentalPricing>;
  getRentalAvailability(countryCode: string, term: string): Promise<{ inStock: boolean; count: number }>;
  orderRental(input: {
    countryCode: string;
    term: string;
    rentalType: string;
    serviceSlug?: string;
  }): Promise<RentalInfo>;
  getRental(supplierNumberId: string): Promise<RentalInfo>;
  cancelRental(supplierNumberId: string): Promise<{ state: RentalState; refundAmount: DecimalString }>;
  listRentals(page: number, limit: number): Promise<Paginated<RentalInfo>>;
}

export interface SupplierAccountProvider {
  getBalance(): Promise<SupplierBalance>;
}

export interface SupplierWebhookVerifier {
  /** Verify authenticity and parse. Throws SupplierWebhookError when invalid. */
  verifyAndParse(rawBody: string, headers: Headers, now?: Date): SupplierWebhookEvent;
}

export interface SupplierAdapter {
  code: string; // "1001sms" | "sandbox"
  name: string;
  mode: "LIVE" | "SANDBOX";
  priceCurrency: string;
  esim: EsimProvider;
  verification: VerificationNumberProvider;
  rentals: RentalNumberProvider;
  account: SupplierAccountProvider;
  webhooks: SupplierWebhookVerifier;
}
