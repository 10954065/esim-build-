import "server-only";
import type { Prisma, WebhookSource, WebhookStatus } from "@/generated/prisma/client";
import { Prisma as P } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { redact } from "@/server/logger";

/**
 * Webhook deduplication and audit. Each (source, externalEventId) is stored once with a
 * redacted payload. A repeat delivery of an already PROCESSED/IGNORED event is acknowledged
 * without reprocessing; a repeat of a RECEIVED/FAILED event is processed again (retry).
 */
export async function recordWebhookEvent(input: {
  source: WebhookSource;
  externalEventId: string;
  eventType: string;
  payload: unknown;
}): Promise<{ id: string; duplicate: boolean }> {
  try {
    const row = await db.webhookEvent.create({
      data: {
        source: input.source,
        externalEventId: input.externalEventId.slice(0, 200),
        eventType: input.eventType.slice(0, 100),
        payload: redact(input.payload) as Prisma.InputJsonValue,
        attempts: 1,
      },
    });
    return { id: row.id, duplicate: false };
  } catch (err) {
    if (!(err instanceof P.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;
    const existing = await db.webhookEvent.update({
      where: { source_externalEventId: { source: input.source, externalEventId: input.externalEventId.slice(0, 200) } },
      data: { attempts: { increment: 1 } },
    });
    return { id: existing.id, duplicate: existing.status === "PROCESSED" || existing.status === "IGNORED" };
  }
}

export async function finishWebhookEvent(id: string, status: Exclude<WebhookStatus, "RECEIVED">, error?: string): Promise<void> {
  await db.webhookEvent.update({
    where: { id },
    data: { status, processedAt: new Date(), error: error ? error.slice(0, 500) : null },
  });
}
