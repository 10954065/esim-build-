import "server-only";
import type { WebhookSource } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { applyEsimWebhook } from "@/server/fulfilment/service";
import { kickJobs } from "@/server/jobs/kick";
import { logger } from "@/server/logger";
import { confirmPayment } from "@/server/payments/confirm";
import { ensureSupplierRecord, SupplierWebhookError, type SupplierAdapter } from "@/server/providers/supplier";
import { PaymentWebhookError, type PaymentGateway } from "@/server/providers/payment";
import { applyGatewayRefundStatus } from "@/server/refunds/service";
import { applySmsWebhook } from "@/server/verification/service";
import { finishWebhookEvent, recordWebhookEvent } from "./events";

/**
 * Shared webhook processing used by the HTTP routes (and by sandbox simulators, so demo
 * flows exercise exactly the same signature verification and deduplication).
 * Returns the HTTP status to send: 2xx tells the sender to stop retrying.
 */

const log = logger.child({ component: "webhooks" });

export interface WebhookOutcome {
  status: number;
  body: { received: boolean; duplicate?: boolean; error?: string };
}

export async function handlePaymentWebhook(gateway: PaymentGateway, source: WebhookSource, rawBody: string, headers: Headers): Promise<WebhookOutcome> {
  let event;
  try {
    event = gateway.verifyWebhook(rawBody, headers);
  } catch (err) {
    const reason = err instanceof PaymentWebhookError ? err.reason : "invalid";
    log.warn("rejected payment webhook", { source, reason });
    return { status: reason === "invalid_payload" ? 400 : 401, body: { received: false, error: "invalid webhook" } };
  }

  const recorded = await recordWebhookEvent({ source, externalEventId: event.eventId, eventType: event.type, payload: safeJson(rawBody) });
  if (recorded.duplicate) return { status: 200, body: { received: true, duplicate: true } };

  try {
    if (event.kind === "charge") {
      await confirmPayment(event.reference, "webhook");
    } else if (event.kind === "refund") {
      const refund = event.gatewayRefundId
        ? await db.refund.findUnique({ where: { gatewayRefundId: event.gatewayRefundId } })
        : event.transactionReference
          ? await db.refund.findFirst({ where: { payment: { reference: event.transactionReference }, status: "PENDING" }, orderBy: { createdAt: "asc" } })
          : null;
      if (!refund) {
        await finishWebhookEvent(recorded.id, "IGNORED", "No matching refund");
        return { status: 200, body: { received: true } };
      }
      // Re-check with the gateway rather than trusting the webhook body alone.
      const confirmed = refund.gatewayRefundId ? (await gateway.getRefund(refund.gatewayRefundId)).status : event.status;
      await applyGatewayRefundStatus(refund.id, confirmed, `webhook:${event.type}`);
    } else {
      await finishWebhookEvent(recorded.id, "IGNORED");
      return { status: 200, body: { received: true } };
    }
    await finishWebhookEvent(recorded.id, "PROCESSED");
    kickJobs();
    return { status: 200, body: { received: true } };
  } catch (err) {
    log.error("payment webhook processing failed", { source, eventType: event.type, err });
    await finishWebhookEvent(recorded.id, "FAILED", err instanceof Error ? err.message : "error");
    // 5xx so the gateway retries; the event is reprocessed because it is not PROCESSED.
    return { status: 500, body: { received: false, error: "processing failed" } };
  }
}

export async function handleSupplierWebhook(adapter: SupplierAdapter, source: WebhookSource, rawBody: string, headers: Headers): Promise<WebhookOutcome> {
  let event;
  try {
    event = adapter.webhooks.verifyAndParse(rawBody, headers);
  } catch (err) {
    const reason = err instanceof SupplierWebhookError ? err.reason : "invalid";
    log.warn("rejected supplier webhook", { source, reason });
    return { status: reason === "invalid_payload" ? 400 : 401, body: { received: false, error: "invalid webhook" } };
  }

  const eventType = event.kind === "esim.update" || event.kind === "number.update" || event.kind === "unsupported" ? event.event : event.kind;
  const recorded = await recordWebhookEvent({ source, externalEventId: event.eventId, eventType, payload: safeJson(rawBody) });
  if (recorded.duplicate) return { status: 200, body: { received: true, duplicate: true } };

  try {
    const supplier = await ensureSupplierRecord(adapter);
    let handled = true;
    if (event.kind === "sms.received") handled = await applySmsWebhook(supplier.id, event.product, event.supplierRef, event.message);
    else if (event.kind === "esim.update") await applyEsimWebhook(event.order);
    else if (event.kind === "number.update") {
      const status = event.event === "number.expired" ? "EXPIRED" : event.event === "number.cancelled" ? "CANCELLED" : null;
      if (status) await db.phoneNumberRental.updateMany({ where: { supplierId: supplier.id, supplierNumberId: event.supplierNumberId }, data: { status } });
    } else handled = false;
    await finishWebhookEvent(recorded.id, handled ? "PROCESSED" : "IGNORED");
    return { status: 200, body: { received: true } };
  } catch (err) {
    log.error("supplier webhook processing failed", { source, eventType, err });
    await finishWebhookEvent(recorded.id, "FAILED", err instanceof Error ? err.message : "error");
    return { status: 500, body: { received: false, error: "processing failed" } };
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { unparseable: true };
  }
}
