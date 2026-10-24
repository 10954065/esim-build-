import { z } from "zod";

/**
 * Supplier order parameters stored on OrderItem.configuration at checkout and used verbatim
 * by fulfilment, so the supplier receives exactly what the customer paid for.
 */
export const itemConfigurationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ESIM"),
    packageCode: z.string().min(1),
    locationCode: z.string().min(1),
    /** Number of days for per-day packages; absent for fixed packages. */
    days: z.number().int().min(1).max(365).optional(),
  }),
  z.object({
    kind: z.literal("VERIFICATION"),
    countryCode: z.string().length(2),
    serviceSlug: z.string().min(1),
    serviceName: z.string().min(1),
    providerTier: z.string().min(1),
    operator: z.string().min(1),
  }),
  z.object({
    kind: z.literal("RENTAL"),
    countryCode: z.string().length(2),
    term: z.string().min(1),
    rentalType: z.string().min(1),
    serviceSlug: z.string().optional(),
  }),
]);

export type ItemConfiguration = z.infer<typeof itemConfigurationSchema>;
