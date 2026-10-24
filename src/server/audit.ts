import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db";
import { redact } from "@/server/logger";

/** Append-only audit trail for privileged and financial actions. Metadata is redacted. */
export interface AuditInput {
  actorId: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function writeAudit(input: AuditInput, tx: Tx | typeof db = db): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ? (redact(input.metadata) as Prisma.InputJsonValue) : undefined,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
