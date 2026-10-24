import "server-only";
import type { ActorType, OrderStatus } from "@/generated/prisma/client";
import type { Tx } from "@/server/db";
import { assertTransition, type OrderStatusValue } from "./state-machine";

/**
 * The only way to change an order's status. Uses a conditional update on the current
 * status so concurrent workers cannot both apply a transition, and records history.
 * Returns false when the order was not in the expected state (another worker won).
 */
export async function transitionOrder(
  tx: Tx,
  input: {
    orderId: string;
    to: OrderStatus;
    from?: OrderStatus | OrderStatus[];
    reason?: string;
    actorType: ActorType;
    actorId?: string | null;
    extra?: { paidAt?: Date; fulfilledAt?: Date; cancelledAt?: Date };
  },
): Promise<boolean> {
  const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId }, select: { status: true } });
  const expected = input.from ? (Array.isArray(input.from) ? input.from : [input.from]) : [order.status];
  if (!expected.includes(order.status)) return false;
  if (order.status === input.to) return true;
  assertTransition(order.status as OrderStatusValue, input.to as OrderStatusValue);

  const res = await tx.order.updateMany({
    where: { id: input.orderId, status: order.status },
    data: { status: input.to, statusReason: input.reason ?? null, ...(input.extra ?? {}) },
  });
  if (res.count === 0) return false;
  await tx.orderStatusHistory.create({
    data: {
      orderId: input.orderId,
      fromStatus: order.status,
      toStatus: input.to,
      reason: input.reason ?? null,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
    },
  });
  return true;
}
