import "server-only";
import type { LedgerAccount } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/server/db";
import { dec, toDbAmount, type DecimalInput } from "@/server/pricing/money";

/**
 * Append-only double-entry ledger. A journal is a balanced set of entries sharing a
 * journalRef (e.g. "payment:<id>"). Posting the same journal twice is a no-op thanks to the
 * unique (journalRef, account, direction) constraint, which makes webhook retries safe.
 * UPDATE/DELETE on LedgerEntry is blocked by a database trigger.
 *
 * Accounts:
 *  GATEWAY_CLEARING — money held at the payment gateway (asset)
 *  SALES_REVENUE    — customer sales (income)
 *  CUSTOMER_REFUNDS — refunds returned to customers (contra-income)
 *  GATEWAY_FEES     — payment processing fees (expense)
 *  SUPPLIER_COST    — cost of goods from the supplier (expense)
 *  SUPPLIER_PREPAID — our prepaid balance with the supplier (asset)
 */

export interface JournalLine {
  account: LedgerAccount;
  direction: "DEBIT" | "CREDIT";
  amount: DecimalInput;
  currency: string;
}

export interface JournalInput {
  journalRef: string;
  description: string;
  orderId?: string | null;
  paymentId?: string | null;
  refundId?: string | null;
  lines: JournalLine[];
}

export class UnbalancedJournalError extends Error {
  constructor(journalRef: string) {
    super(`Journal ${journalRef} does not balance`);
    this.name = "UnbalancedJournalError";
  }
}

export function assertBalanced(input: JournalInput): void {
  const byCurrency = new Map<string, ReturnType<typeof dec>>();
  for (const line of input.lines) {
    if (dec(line.amount).isNegative()) throw new Error("Ledger amounts must be non-negative");
    const signed = line.direction === "DEBIT" ? dec(line.amount) : dec(line.amount).negated();
    byCurrency.set(line.currency, (byCurrency.get(line.currency) ?? dec(0)).plus(signed));
  }
  for (const total of byCurrency.values()) if (!total.isZero()) throw new UnbalancedJournalError(input.journalRef);
}

/** Post a balanced journal. Returns false if it was already posted. */
export async function postJournal(tx: Tx, input: JournalInput): Promise<boolean> {
  assertBalanced(input);
  const existing = await tx.ledgerEntry.count({ where: { journalRef: input.journalRef } });
  if (existing > 0) return false;
  try {
    await tx.ledgerEntry.createMany({
      data: input.lines
        .filter((l) => !dec(l.amount).isZero())
        .map((l) => ({
          journalRef: input.journalRef,
          account: l.account,
          direction: l.direction,
          amount: toDbAmount(l.amount),
          currency: l.currency,
          description: input.description,
          orderId: input.orderId ?? null,
          paymentId: input.paymentId ?? null,
          refundId: input.refundId ?? null,
        })),
    });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
    throw err;
  }
}
