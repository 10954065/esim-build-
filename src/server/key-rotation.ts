import "server-only";
import { reencryptField } from "@/server/crypto";
import { db } from "@/server/db";
import { logger } from "@/server/logger";

/**
 * After a DATA_ENCRYPTION_KEY rotation, re-encrypt every stored secret with the current key so
 * the retired key can be removed. Safe to interrupt and rerun: values already on the current key
 * are skipped, and a row is only rewritten if it has not changed since it was read.
 */

const log = logger.child({ component: "key-rotation" });

export interface ReencryptResult {
  scanned: number;
  reencrypted: number;
  /** Values no configured key can decrypt; left untouched and logged by row id. */
  unreadable: number;
}

function rotateValues(rowId: string, values: Record<string, string | null>, result: ReencryptResult): Record<string, string> {
  const changed: Record<string, string> = {};
  for (const [field, value] of Object.entries(values)) {
    if (!value) continue;
    result.scanned++;
    try {
      const next = reencryptField(value);
      if (next) changed[field] = next;
    } catch {
      result.unreadable++;
      log.warn("stored value cannot be decrypted with any configured key", { rowId, field });
    }
  }
  return changed;
}

/** Keep the old ciphertext in the WHERE clause so a concurrent write is never overwritten. */
function unchanged(values: Record<string, string | null>, changed: Record<string, string>) {
  return Object.fromEntries(Object.keys(changed).map((field) => [field, values[field]]));
}

async function forEachRow<T extends { id: string }>(load: (cursor: string | undefined) => Promise<T[]>, handle: (row: T) => Promise<void>): Promise<void> {
  let cursor: string | undefined;
  for (;;) {
    const rows: T[] = await load(cursor);
    if (rows.length === 0) return;
    for (const row of rows) await handle(row);
    cursor = rows[rows.length - 1]!.id;
  }
}

export async function reencryptStoredData(batchSize = 200): Promise<ReencryptResult> {
  const result: ReencryptResult = { scanned: 0, reencrypted: 0, unreadable: 0 };
  const page = (cursor: string | undefined) => ({ orderBy: { id: "asc" as const }, take: batchSize, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) });

  await forEachRow(
    (cursor) => db.esimActivation.findMany({ select: { id: true, activationCodeEnc: true, qrCodeUrlEnc: true }, ...page(cursor) }),
    async ({ id, ...values }) => {
      const changed = rotateValues(id, values, result);
      if (Object.keys(changed).length === 0) return;
      const res = await db.esimActivation.updateMany({ where: { id, ...unchanged(values, changed) }, data: changed });
      if (res.count === 1) result.reencrypted += Object.keys(changed).length;
    },
  );

  await forEachRow(
    (cursor) => db.incomingSmsMessage.findMany({ select: { id: true, bodyEnc: true, codeEnc: true }, ...page(cursor) }),
    async ({ id, ...values }) => {
      const changed = rotateValues(id, values, result);
      if (Object.keys(changed).length === 0) return;
      const res = await db.incomingSmsMessage.updateMany({ where: { id, ...unchanged(values, changed) }, data: changed });
      if (res.count === 1) result.reencrypted += Object.keys(changed).length;
    },
  );

  log.info("re-encryption pass complete", { ...result });
  return result;
}
