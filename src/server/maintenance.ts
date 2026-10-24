import "server-only";
import { RETENTION } from "@/lib/retention";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { purgeExpiredRateLimits } from "@/server/rate-limit";

const DAY = 24 * 3600 * 1000;

/**
 * Enforces the retention rules published in the privacy policy (src/lib/retention.ts).
 * Financial records (payments with a successful charge, refunds, ledger) are never deleted here.
 */
export async function runRetention(now = new Date()): Promise<Record<string, number>> {
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const result: Record<string, number> = {};

  result.smsDeleted = (await db.incomingSmsMessage.deleteMany({ where: { receivedAt: { lt: ago(RETENTION.smsContentDays) } } })).count;

  result.verificationNumbersAnonymised = (
    await db.verificationActivation.updateMany({
      where: { expiresAt: { lt: ago(RETENTION.phoneNumberDays) }, NOT: { phoneNumber: "+REDACTED" } },
      data: { phoneNumber: "+REDACTED" },
    })
  ).count;
  result.rentalNumbersAnonymised = (
    await db.phoneNumberRental.updateMany({
      where: { expiresAt: { lt: ago(RETENTION.phoneNumberDays) }, NOT: { phoneNumber: "+REDACTED" } },
      data: { phoneNumber: "+REDACTED" },
    })
  ).count;

  // Abandoned orders: cancelled, never paid, no refunds.
  const abandoned = await db.order.findMany({
    where: { status: "CANCELLED", createdAt: { lt: ago(RETENTION.abandonedOrderDays) }, payments: { none: { status: "SUCCEEDED" } }, refunds: { none: {} } },
    select: { id: true },
    take: 500,
  });
  const ids = abandoned.map((o) => o.id);
  if (ids.length) {
    await db.$transaction([
      db.payment.deleteMany({ where: { orderId: { in: ids } } }),
      db.order.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }
  result.abandonedOrdersDeleted = ids.length;

  result.emailPreviewsCleared = (
    await db.emailDelivery.updateMany({ where: { createdAt: { lt: ago(RETENTION.emailPreviewDays) }, devPreview: { not: null } }, data: { devPreview: null } })
  ).count;
  result.webhookEventsDeleted = (await db.webhookEvent.deleteMany({ where: { receivedAt: { lt: ago(RETENTION.webhookPayloadDays) } } })).count;
  result.auditLogsDeleted = (await db.auditLog.deleteMany({ where: { createdAt: { lt: ago(RETENTION.auditLogYears * 365) } } })).count;
  result.jobsDeleted = (await db.job.deleteMany({ where: { status: { in: ["SUCCEEDED", "DEAD"] }, updatedAt: { lt: ago(30) } } })).count;
  result.expiredSessionsDeleted = (await db.session.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  result.rateLimitBucketsDeleted = await purgeExpiredRateLimits();

  logger.info("retention run complete", result);
  return result;
}
