import { z } from "zod";

/**
 * Zod schemas for documented 1001SMS responses (https://www.1001sms.com/api-docs).
 * Schemas are permissive about extra fields and strict about the fields we rely on.
 * Prices may arrive as numbers or numeric strings; both are normalized to strings.
 */

export const decimalLike = z
  .union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
  .transform((v) => (typeof v === "number" ? v.toString() : v));

export const nullableDate = z
  .string()
  .nullish()
  .transform((v) => (v ? new Date(v) : null));

export const bigIntLike = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .nullish()
  .transform((v) => (v === null || v === undefined ? null : BigInt(v)));

export const envelope = <T extends z.ZodTypeAny>(data: T) => z.object({ success: z.literal(true), data });

export const errorEnvelope = z.object({
  success: z.literal(false).optional(),
  error: z.string().optional(),
  required: z.union([z.number(), z.string()]).optional(),
});

// ───── Lookup ─────

export const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  slug: z.string(),
  price: decimalLike.optional(),
  popular: z.boolean().optional().default(false),
  iconPath: z.string().nullish(),
});

export const countrySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  code: z.string().length(2),
  slug: z.string(),
  flag: z.string().nullish(),
  continent: z.string().nullish(),
  phoneCode: z.string().nullish(),
});

export const operatorSchema = z.object({
  operator: z.string(),
  price: decimalLike,
  count: z.number().int().nonnegative(),
  deliverability: z.number().nullish(),
  provider: z.string(),
});

export const pricingByCountrySchema = z.object({
  country: z.string().optional(),
  countryCode: z.string().optional(),
  countrySlug: z.string().optional(),
  services: z.array(
    z.object({
      service: z.string(),
      serviceName: z.string().optional(),
      operators: z.array(operatorSchema),
    }),
  ),
});

export const pricingCountryServiceSchema = z.object({
  country: z.string().optional(),
  service: z.string().optional(),
  operators: z.array(operatorSchema),
});

export const balanceSchema = z.object({
  balance: decimalLike,
  username: z.string().optional(),
  email: z.string().optional(),
});

// ───── Activations ─────

export const smsMessageSchema = z.object({
  id: z.string(),
  sender: z.string().nullish(),
  message: z.string().nullish(),
  text: z.string().nullish(),
  code: z.string().nullish(),
  receivedAt: z.string(),
});

export const activationOrderSchema = z.object({
  id: z.string(),
  phoneNumber: z.string(),
  countryCode: z.string().nullish(),
  countryName: z.string().nullish(),
  serviceId: z.string().nullish(),
  serviceName: z.string().nullish(),
  operatorName: z.string().nullish(),
  price: decimalLike,
  status: z.string(),
  provider: z.string().nullish(),
  providerId: z.string().nullish(),
  expiresAt: z.string(),
  rentedAt: z.string().nullish(),
  messages: z.array(smsMessageSchema).optional(),
});

export const activationCheckSchema = z.object({
  hasMessage: z.boolean(),
  messages: z.array(smsMessageSchema),
  status: z.string(),
  providerStatus: z.string().nullish(),
});

export const activationCancelSchema = z.object({
  id: z.string(),
  status: z.string(),
  refundAmount: decimalLike.nullish(),
  refundReason: z.string().nullish(),
});

// List endpoints: items are validated one by one in the adapter so a single
// unexpected item cannot break reconciliation.
export const activationListSchema = z.object({
  orders: z.array(z.record(z.string(), z.unknown())),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});

// ───── Virtual numbers ─────

export const numberCountrySchema = z.object({
  code: z.string().length(2),
  name: z.string(),
  phoneCode: z.string().nullish(),
  types: z.array(z.string()).default([]),
});

export const termPriceSchema = z.object({
  term: z.string(),
  days: z.number().nullish(),
  hours: z.number().nullish(),
  price: decimalLike,
});

export const numberPricingSchema = z.object({
  unlimited: z.array(termPriceSchema).default([]),
  services: z
    .array(
      z.object({
        service: z.string(),
        name: z.string().nullish(),
        fromPrice: decimalLike.nullish(),
        // The docs list `terms[]` without its element shape. We assume the unlimited-term
        // shape and drop entries that do not match (see adapter).
        terms: z.array(z.unknown()).default([]),
      }),
    )
    .default([]),
});

export const numberAvailabilitySchema = z.object({
  country: z.string().optional(),
  term: z.string().optional(),
  count: z.number().int().nonnegative(),
  inStock: z.boolean(),
});

export const numberSchema = z.object({
  id: z.string(),
  phoneNumber: z.string(),
  country: z.string(),
  countryName: z.string().nullish(),
  type: z.string(),
  service: z.string().nullish(),
  serviceName: z.string().nullish(),
  term: z.string(),
  days: z.number().nullish(),
  status: z.string(),
  price: decimalLike,
  autoRenew: z.boolean().nullish(),
  rentedAt: z.string(),
  expiresAt: z.string(),
  messages: z.array(smsMessageSchema).optional(),
});

export const numberListSchema = z.object({
  numbers: z.array(z.record(z.string(), z.unknown())),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});

export const numberCancelSchema = z.object({
  number: z.object({ status: z.string().optional() }).passthrough(),
  refundAmount: decimalLike.nullish(),
});

// ───── eSIMs ─────

export const destinationSchema = z.object({
  locationCode: z.string(),
  name: z.string(),
  kind: z.string(),
  packageCount: z.number().int().nonnegative().default(0),
  fromPrice: decimalLike.nullish(),
  fromUnlimited: z.boolean().nullish(),
  topSpeed: z.string().nullish(),
});

export const destinationsSchema = z.object({
  count: z.number().int().optional(),
  destinations: z.array(destinationSchema),
});

export const packageSchema = z.object({
  id: z.string().optional(),
  packageCode: z.string(),
  name: z.string(),
  locationCode: z.string(),
  locationName: z.string(),
  volumeLabel: z.string().nullish(),
  volumeBytes: bigIntLike,
  durationDays: z.number().int().nullish(),
  speed: z.string().nullish(),
  price: decimalLike,
  unlimited: z.boolean().default(false),
  pricingUnit: z.string().nullish(),
  fupPolicy: z.string().nullish(),
  fupKbps: z.number().nullish(),
  ipExport: z.string().nullish(),
});

export const packagesSchema = z.object({
  location: z.string().optional(),
  count: z.number().int().optional(),
  packages: z.array(packageSchema),
});

export const profileSchema = z.object({
  id: z.string(),
  esimTranNo: z.string().nullish(),
  iccid: z.string().nullish(),
  activationCode: z.string().nullish(),
  qrCodeUrl: z.string().nullish(),
  shortUrl: z.string().nullish(),
  apn: z.string().nullish(),
  status: z.string().nullish(),
  smdpStatus: z.string().nullish(),
  totalVolume: bigIntLike,
  usedVolume: bigIntLike,
  activatedAt: nullableDate,
  expiresAt: nullableDate,
});

export const esimOrderSchema = z.object({
  id: z.string(),
  status: z.string(),
  packageCode: z.string(),
  packageName: z.string().nullish(),
  unlimited: z.boolean().nullish(),
  days: z.number().nullish(),
  locationCode: z.string().nullish(),
  quantity: z.number().int().nullish(),
  price: decimalLike,
  createdAt: z.string().nullish(),
  ready: z.boolean().default(false),
  profiles: z.array(profileSchema).default([]),
  lifecycle: z.string(),
});

export const esimOrderListSchema = z.object({
  orders: z.array(z.record(z.string(), z.unknown())),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});

// ───── Webhooks ─────

export const webhookEnvelopeSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  createdAt: z.string().nullish(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const smsReceivedDataSchema = z.object({
  product: z.string().nullish(),
  numberId: z.string().nullish(),
  orderId: z.string().nullish(),
  activationId: z.string().nullish(),
  message: smsMessageSchema,
});
