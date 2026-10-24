import { SupplierWebhookError } from "../errors";
import { verifySignedPayload } from "../signature";
import type { SupplierWebhookEvent, SupplierWebhookVerifier } from "../types";
import { mapEsimOrder, mapMessage } from "./mappers";
import { esimOrderSchema, smsReceivedDataSchema, webhookEnvelopeSchema } from "./schemas";

export const SIGNATURE_HEADER = "x-1001sms-signature";

/** Parse an already-authenticated webhook body into a normalized event. */
export function parseSupplierWebhookBody(rawBody: string): SupplierWebhookEvent {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new SupplierWebhookError("invalid_payload", "Body is not JSON");
  }
  const env = webhookEnvelopeSchema.safeParse(json);
  if (!env.success) throw new SupplierWebhookError("invalid_payload", "Envelope does not match documented format");

  const { id: eventId, event, data } = env.data;
  const createdAt = env.data.createdAt ? new Date(env.data.createdAt) : null;

  if (event === "ping") return { kind: "ping", eventId, createdAt };

  if (event === "sms.received") {
    const parsed = smsReceivedDataSchema.safeParse(data);
    if (!parsed.success) throw new SupplierWebhookError("invalid_payload", "sms.received data invalid");
    const d = parsed.data;
    const isRental = d.product === "virtual_number" || (!d.orderId && !d.activationId && !!d.numberId);
    const supplierRef = isRental ? d.numberId : (d.orderId ?? d.activationId ?? d.numberId);
    if (!supplierRef) throw new SupplierWebhookError("invalid_payload", "sms.received has no order reference");
    return {
      kind: "sms.received",
      eventId,
      createdAt,
      product: isRental ? "rental" : "activation",
      supplierRef,
      message: mapMessage(d.message),
    };
  }

  if (event.startsWith("esim.")) {
    const order = esimOrderSchema.safeParse((data as { order?: unknown }).order);
    if (!order.success) throw new SupplierWebhookError("invalid_payload", `${event} order invalid`);
    return { kind: "esim.update", eventId, createdAt, event, order: mapEsimOrder(order.data) };
  }

  if (event.startsWith("number.")) {
    const d = data as { numberId?: unknown; number?: { id?: unknown } };
    const supplierNumberId = typeof d.numberId === "string" ? d.numberId : typeof d.number?.id === "string" ? d.number.id : null;
    if (!supplierNumberId) throw new SupplierWebhookError("invalid_payload", `${event} has no number id`);
    return { kind: "number.update", eventId, createdAt, event, supplierNumberId };
  }

  return { kind: "unsupported", eventId, createdAt, event };
}

export function createSignedWebhookVerifier(secret: string | undefined, headerName = SIGNATURE_HEADER): SupplierWebhookVerifier {
  return {
    verifyAndParse(rawBody, headers, now = new Date()) {
      verifySignedPayload(rawBody, headers.get(headerName), secret, now);
      return parseSupplierWebhookBody(rawBody);
    },
  };
}
