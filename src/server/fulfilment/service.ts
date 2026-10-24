import "server-only";
import type { Fulfilment, OrderItem } from "@/generated/prisma/client";
import { writeAudit } from "@/server/audit";
import { encryptOptional } from "@/server/crypto";
import { db, type Tx } from "@/server/db";
import { sendEmail } from "@/server/email";
import { templates } from "@/server/email/templates";
import { enqueue, PermanentJobError } from "@/server/jobs/queue";
import { postJournal } from "@/server/ledger";
import { logger } from "@/server/logger";
import { notify } from "@/server/notifications";
import { itemConfigurationSchema, type ItemConfiguration } from "@/server/orders/configuration";
import { transitionOrder } from "@/server/orders/service";
import { dec, toDbAmount } from "@/server/pricing/money";
import { getSupplierAdapter, isSupplierError, SupplierError, type SupplierAdapter } from "@/server/providers/supplier";
import type { ActivationInfo, EsimOrderInfo, RentalInfo } from "@/server/providers/supplier/types";
import { requestRefund } from "@/server/refunds/service";

/**
 * Idempotent fulfilment.
 * - Exactly one worker can submit an item: the Fulfilment row is claimed with a conditional
 *   update (PENDING → SUBMITTING) before the supplier is called, and the supplier call never
 *   happens inside a database transaction.
 * - 1001SMS offers no idempotency key, so an uncertain outcome (timeout / 5xx) is NEVER
 *   retried blindly: it becomes UNCERTAIN and is reconciled against the supplier's order list.
 * - Definite failures are refunded automatically; operator problems (balance, credentials)
 *   go to NEEDS_REVIEW so staff can fix them and retry.
 */

const log = logger.child({ component: "fulfilment" });
const MAX_SUPPLIER_ATTEMPTS = 3;
const OPERATOR_ERRORS = new Set(["INSUFFICIENT_BALANCE", "UNAUTHORIZED", "NOT_CONFIGURED"]);

type ItemWithOrder = OrderItem & { order: { id: string; number: string; userId: string; isSandbox: boolean; user: { email: string; name: string } } };

async function loadItem(orderItemId: string): Promise<ItemWithOrder> {
  return db.orderItem.findUniqueOrThrow({
    where: { id: orderItemId },
    include: { order: { select: { id: true, number: true, userId: true, isSandbox: true, user: { select: { email: true, name: true } } } } },
  });
}

export async function fulfilOrderItem(orderItemId: string): Promise<void> {
  const item = await loadItem(orderItemId);
  const adapter = getSupplierAdapter();
  if (item.order.isSandbox !== (adapter.mode === "SANDBOX")) {
    // Never fulfil a demo order with a live supplier or a real order with the sandbox.
    throw new PermanentJobError("Order sandbox flag does not match the configured supplier mode");
  }

  const claimed = await db.fulfilment.updateMany({
    where: { orderItemId, status: "PENDING" },
    data: { status: "SUBMITTING", attempts: { increment: 1 }, submittedAt: new Date(), lastError: null, lastErrorCode: null },
  });
  if (claimed.count === 0) return; // already submitted, finished, or being handled
  const fulfilment = await db.fulfilment.findUniqueOrThrow({ where: { orderItemId } });

  await db.$transaction((tx) =>
    transitionOrder(tx, { orderId: item.orderId, from: ["PAID", "NEEDS_REVIEW", "FAILED"], to: "FULFILLING", reason: "Submitting to supplier", actorType: "SYSTEM" }),
  );

  const config = itemConfigurationSchema.parse(item.configuration);
  try {
    await submitToSupplier(adapter, fulfilment, item, config);
  } catch (err) {
    if (!isSupplierError(err)) {
      // Unknown local error after the supplier may have accepted: treat as uncertain.
      await markUncertain(fulfilment.id, err instanceof Error ? err.message : "Unexpected error");
      return;
    }
    await handleSupplierError(fulfilment, item, err);
  }
}

async function submitToSupplier(adapter: SupplierAdapter, f: Fulfilment, item: ItemWithOrder, config: ItemConfiguration): Promise<void> {
  if (config.kind === "ESIM") {
    const order = await adapter.esim.orderEsim({ packageCode: config.packageCode, quantity: 1, days: config.days });
    await persistEsim(f, item, order);
  } else if (config.kind === "VERIFICATION") {
    const activation = await adapter.verification.orderActivation({
      countryCode: config.countryCode,
      serviceSlug: config.serviceSlug,
      providerTier: config.providerTier,
      operator: config.operator,
    });
    await persistVerification(f, item, activation);
  } else {
    const rental = await adapter.rentals.orderRental({
      countryCode: config.countryCode,
      term: config.term,
      rentalType: config.rentalType,
      serviceSlug: config.serviceSlug,
    });
    await persistRental(f, item, rental);
  }
}

// ───────────── Persisting supplier results ─────────────

async function recordSupplierCost(tx: Tx, f: Fulfilment, item: ItemWithOrder, cost: string, currency: string): Promise<void> {
  await postJournal(tx, {
    journalRef: `supplier:${f.id}`,
    description: `Supplier cost for order ${item.order.number}`,
    orderId: item.orderId,
    lines: [
      { account: "SUPPLIER_COST", direction: "DEBIT", amount: cost, currency },
      { account: "SUPPLIER_PREPAID", direction: "CREDIT", amount: cost, currency },
    ],
  });
}

async function completeOrderIfDone(tx: Tx, orderId: string): Promise<boolean> {
  const items = await tx.orderItem.findMany({ where: { orderId }, include: { fulfilment: { select: { status: true } } } });
  if (!items.every((i) => i.fulfilment?.status === "SUCCEEDED")) return false;
  return transitionOrder(tx, { orderId, from: ["FULFILLING", "NEEDS_REVIEW"], to: "FULFILLED", reason: "Supplier delivered all items", actorType: "SYSTEM", extra: { fulfilledAt: new Date() } });
}

export async function persistEsim(f: Fulfilment, item: ItemWithOrder, order: EsimOrderInfo): Promise<void> {
  const adapter = getSupplierAdapter();
  const ready = order.ready && order.profiles.some((p) => p.activationCode);
  let firstEsimId: string | null = null;
  const done = await db.$transaction(async (tx) => {
    await tx.fulfilment.update({
      where: { id: f.id },
      data: { supplierOrderRef: order.supplierOrderId, supplierCost: toDbAmount(order.cost), status: ready ? "SUCCEEDED" : "AWAITING_SUPPLIER", completedAt: ready ? new Date() : null },
    });
    for (const p of order.profiles) {
      const row = await tx.esimActivation.upsert({
        where: { supplierId_supplierProfileId: { supplierId: f.supplierId, supplierProfileId: p.supplierProfileId } },
        update: {
          iccid: p.iccid,
          activationCodeEnc: encryptOptional(p.activationCode),
          qrCodeUrlEnc: encryptOptional(p.qrCodeUrl),
          apn: p.apn,
          supplierStatus: p.status,
          status: ready ? "READY" : "PREPARING",
          totalVolumeBytes: p.totalVolumeBytes,
          usedVolumeBytes: p.usedVolumeBytes,
          activatedAt: p.activatedAt,
          expiresAt: p.expiresAt,
          lastRefreshedAt: new Date(),
        },
        create: {
          orderItemId: item.id,
          userId: item.order.userId,
          supplierId: f.supplierId,
          supplierOrderRef: order.supplierOrderId,
          supplierProfileId: p.supplierProfileId,
          iccid: p.iccid,
          activationCodeEnc: encryptOptional(p.activationCode),
          qrCodeUrlEnc: encryptOptional(p.qrCodeUrl),
          apn: p.apn,
          supplierStatus: p.status,
          status: ready ? "READY" : "PREPARING",
          totalVolumeBytes: p.totalVolumeBytes,
          usedVolumeBytes: p.usedVolumeBytes,
          activatedAt: p.activatedAt,
          expiresAt: p.expiresAt,
          lastRefreshedAt: new Date(),
          isSandbox: item.order.isSandbox,
        },
      });
      firstEsimId ??= row.id;
    }
    if (!ready) return false;
    await recordSupplierCost(tx, f, item, order.cost, adapter.priceCurrency);
    await completeOrderIfDone(tx, item.orderId);
    await notify(tx, {
      userId: item.order.userId,
      type: "esim.ready",
      title: "Your eSIM is ready",
      body: `Order ${item.order.number}: open the installation page to scan your QR code.`,
      link: firstEsimId ? `/dashboard/esims/${firstEsimId}` : `/dashboard/orders/${item.orderId}`,
      dedupeKey: `esim-ready:${f.id}`,
    });
    return true;
  });
  if (done && firstEsimId) {
    await sendEmail({
      to: item.order.user.email,
      userId: item.order.userId,
      email: templates.esimReady({ name: item.order.user.name, orderNumber: item.order.number, esimId: firstEsimId }),
      dedupeKey: `email:esim-ready:${f.id}`,
    });
  }
}

export async function persistVerification(f: Fulfilment, item: ItemWithOrder, a: ActivationInfo): Promise<void> {
  const adapter = getSupplierAdapter();
  const config = itemConfigurationSchema.parse(item.configuration);
  const verification = await db.$transaction(async (tx) => {
    await tx.fulfilment.update({
      where: { id: f.id },
      data: { supplierOrderRef: a.supplierOrderId, supplierCost: toDbAmount(a.cost), status: "SUCCEEDED", completedAt: new Date() },
    });
    const v = await tx.verificationActivation.upsert({
      where: { orderItemId: item.id },
      update: {},
      create: {
        orderItemId: item.id,
        userId: item.order.userId,
        supplierId: f.supplierId,
        supplierOrderRef: a.supplierOrderId,
        phoneNumber: a.phoneNumber,
        countryCode: (a.countryCode || (config.kind === "VERIFICATION" ? config.countryCode : "")).slice(0, 2).toUpperCase(),
        serviceSlug: a.serviceSlug || (config.kind === "VERIFICATION" ? config.serviceSlug : ""),
        serviceName: config.kind === "VERIFICATION" ? config.serviceName : a.serviceName,
        operator: a.operator,
        providerTier: a.providerTier,
        status: "WAITING",
        supplierStatus: a.supplierStatus,
        expiresAt: a.expiresAt,
        isSandbox: item.order.isSandbox,
      },
    });
    await recordSupplierCost(tx, f, item, a.cost, adapter.priceCurrency);
    await completeOrderIfDone(tx, item.orderId);
    await notify(tx, {
      userId: item.order.userId,
      type: "verification.issued",
      title: "Your verification number is ready",
      body: `Order ${item.order.number}: request your code now — the number has a time limit.`,
      link: `/dashboard/verification/${v.id}`,
      dedupeKey: `verification-issued:${f.id}`,
    });
    return v;
  });
  await sendEmail({
    to: item.order.user.email,
    userId: item.order.userId,
    email: templates.numberIssued({ name: item.order.user.name, orderNumber: item.order.number, path: `/dashboard/verification/${verification.id}`, kind: "verification" }),
    dedupeKey: `email:verification-issued:${f.id}`,
  });
}

export async function persistRental(f: Fulfilment, item: ItemWithOrder, r: RentalInfo): Promise<void> {
  const adapter = getSupplierAdapter();
  await db.$transaction(async (tx) => {
    await tx.fulfilment.update({
      where: { id: f.id },
      data: { supplierOrderRef: r.supplierNumberId, supplierCost: toDbAmount(r.cost), status: "SUCCEEDED", completedAt: new Date() },
    });
    await tx.phoneNumberRental.upsert({
      where: { orderItemId: item.id },
      update: {},
      create: {
        orderItemId: item.id,
        userId: item.order.userId,
        supplierId: f.supplierId,
        supplierNumberId: r.supplierNumberId,
        phoneNumber: r.phoneNumber,
        countryCode: r.countryCode.slice(0, 2),
        rentalType: r.rentalType,
        serviceSlug: r.serviceSlug,
        serviceName: r.serviceName,
        term: r.term,
        status: "ACTIVE",
        rentedAt: r.rentedAt,
        expiresAt: r.expiresAt,
        isSandbox: item.order.isSandbox,
      },
    });
    await recordSupplierCost(tx, f, item, r.cost, adapter.priceCurrency);
    await completeOrderIfDone(tx, item.orderId);
    await notify(tx, {
      userId: item.order.userId,
      type: "rental.issued",
      title: "Your rental number is active",
      body: `Order ${item.order.number}: your number is ready to receive SMS.`,
      link: "/dashboard/rentals",
      dedupeKey: `rental-issued:${f.id}`,
    });
  });
  await sendEmail({
    to: item.order.user.email,
    userId: item.order.userId,
    email: templates.numberIssued({ name: item.order.user.name, orderNumber: item.order.number, path: "/dashboard/rentals", kind: "rental" }),
    dedupeKey: `email:rental-issued:${f.id}`,
  });
}

// ───────────── Failure handling ─────────────

async function markUncertain(fulfilmentId: string, message: string): Promise<void> {
  await db.fulfilment.update({ where: { id: fulfilmentId }, data: { status: "UNCERTAIN", lastErrorCode: "UNCERTAIN", lastError: message.slice(0, 500) } });
  await enqueue(db, { type: "reconcile-fulfilment", payload: { fulfilmentId, attempt: 1 }, runAt: new Date(Date.now() + 60 * 1000), dedupeKey: `reconcile:${fulfilmentId}:1` });
  log.warn("fulfilment outcome uncertain; scheduled reconciliation", { fulfilmentId });
}

async function sendToReview(f: Fulfilment, item: ItemWithOrder, reason: string, code: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.fulfilment.update({ where: { id: f.id }, data: { status: "NEEDS_REVIEW", lastErrorCode: code, lastError: reason.slice(0, 500) } });
    await transitionOrder(tx, { orderId: item.orderId, from: ["FULFILLING", "PAID"], to: "NEEDS_REVIEW", reason, actorType: "SYSTEM" });
    await writeAudit({ actorId: null, action: "fulfilment.needs_review", entityType: "order", entityId: item.orderId, reason, metadata: { fulfilmentId: f.id, code } }, tx);
  });
  await sendEmail({
    to: item.order.user.email,
    userId: item.order.userId,
    email: templates.fulfilmentProblem({ name: item.order.user.name, orderNumber: item.order.number, orderId: item.orderId }),
    dedupeKey: `email:fulfilment-problem:${f.id}`,
  });
}

async function failAndRefund(f: Fulfilment, item: ItemWithOrder, reason: string, code: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.fulfilment.update({ where: { id: f.id }, data: { status: "FAILED", lastErrorCode: code, lastError: reason.slice(0, 500) } });
    await transitionOrder(tx, { orderId: item.orderId, from: ["FULFILLING", "PAID", "NEEDS_REVIEW"], to: "FAILED", reason, actorType: "SYSTEM" });
  });
  await requestRefund({
    orderId: item.orderId,
    reason: "The supplier could not fulfil your order",
    initiatedByType: "SYSTEM",
    idempotencyKey: `fulfilment-failed:${f.id}`,
  });
}

async function handleSupplierError(f: Fulfilment, item: ItemWithOrder, err: SupplierError): Promise<void> {
  const attempts = (await db.fulfilment.findUniqueOrThrow({ where: { id: f.id }, select: { attempts: true } })).attempts;
  log.warn("supplier rejected fulfilment", { fulfilmentId: f.id, kind: err.kind, attempts });

  if (err.uncertain) return markUncertain(f.id, err.toSafeString());
  if (OPERATOR_ERRORS.has(err.kind)) return sendToReview(f, item, err.toSafeString(), err.kind);
  if (err.retryable && attempts < MAX_SUPPLIER_ATTEMPTS) {
    await db.fulfilment.update({ where: { id: f.id }, data: { status: "PENDING", lastErrorCode: err.kind, lastError: err.toSafeString() } });
    throw err; // the job retries with backoff
  }
  return failAndRefund(f, item, err.toSafeString(), err.kind);
}

// ───────────── Reconciliation of uncertain outcomes ─────────────

const WINDOW_BEFORE_MS = 2 * 60 * 1000;
const WINDOW_AFTER_MS = 10 * 60 * 1000;

function inWindow(at: Date | null, submittedAt: Date): boolean {
  if (!at) return false;
  const t = at.getTime();
  return t >= submittedAt.getTime() - WINDOW_BEFORE_MS && t <= submittedAt.getTime() + WINDOW_AFTER_MS;
}

export async function reconcileFulfilment(fulfilmentId: string, attempt: number): Promise<void> {
  const f = await db.fulfilment.findUniqueOrThrow({ where: { id: fulfilmentId } });
  if (f.status !== "UNCERTAIN") return;
  const item = await loadItem(f.orderItemId);
  const adapter = getSupplierAdapter();
  const config = itemConfigurationSchema.parse(item.configuration);
  const submittedAt = f.submittedAt ?? f.updatedAt;
  const linkedRefs = new Set(
    (await db.fulfilment.findMany({ where: { supplierId: f.supplierId, supplierOrderRef: { not: null } }, select: { supplierOrderRef: true } })).map((r) => r.supplierOrderRef!),
  );

  let candidates: string[] = [];
  if (config.kind === "ESIM") {
    const page = await adapter.esim.listEsimOrders(1, 50);
    candidates = page.items.filter((o) => o.packageCode === config.packageCode && inWindow(o.createdAt, submittedAt) && !linkedRefs.has(o.supplierOrderId)).map((o) => o.supplierOrderId);
  } else if (config.kind === "VERIFICATION") {
    const page = await adapter.verification.listRecentActivations(1, 50);
    candidates = page.items
      .filter((a) => a.serviceSlug === config.serviceSlug && a.countryCode === config.countryCode && inWindow(a.createdAt, submittedAt) && !linkedRefs.has(a.supplierOrderId))
      .map((a) => a.supplierOrderId);
  } else {
    const page = await adapter.rentals.listRentals(1, 50);
    candidates = page.items
      .filter((r) => r.countryCode === config.countryCode && r.term === config.term && r.rentalType === config.rentalType && inWindow(r.rentedAt, submittedAt) && !linkedRefs.has(r.supplierNumberId))
      .map((r) => r.supplierNumberId);
  }

  if (candidates.length === 1) {
    const ref = candidates[0]!;
    log.info("reconciled uncertain fulfilment", { fulfilmentId, supplierRef: ref });
    if (config.kind === "ESIM") await persistEsim(f, item, await adapter.esim.getEsimOrder(ref));
    else if (config.kind === "VERIFICATION") await persistVerification(f, item, await adapter.verification.getActivation(ref));
    else await persistRental(f, item, await adapter.rentals.getRental(ref));
    return;
  }
  if (candidates.length === 0 && attempt < 3) {
    // Supplier lists can lag; check again before concluding.
    await enqueue(db, { type: "reconcile-fulfilment", payload: { fulfilmentId, attempt: attempt + 1 }, runAt: new Date(Date.now() + 2 * 60 * 1000), dedupeKey: `reconcile:${fulfilmentId}:${attempt + 1}` });
    return;
  }
  const reason =
    candidates.length === 0
      ? "Supplier response was lost and no matching supplier order was found. Verify with the supplier before retrying or refunding."
      : `Supplier response was lost and ${candidates.length} possible supplier orders match. Manual matching required.`;
  await sendToReview(f, item, reason, "RECONCILE_" + (candidates.length === 0 ? "NONE" : "AMBIGUOUS"));
}

// ───────────── eSIM preparation follow-up ─────────────

/** Sweep: complete eSIM orders that the supplier was still preparing. */
export async function sweepPreparingEsims(limit = 20): Promise<number> {
  const pending = await db.fulfilment.findMany({
    where: { status: "AWAITING_SUPPLIER", supplierOrderRef: { not: null } },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
  const adapter = getSupplierAdapter();
  let completed = 0;
  for (const f of pending) {
    try {
      const order = await adapter.esim.getEsimOrder(f.supplierOrderRef!, { refresh: true });
      if (order.lifecycle === "FAILED" || order.lifecycle === "CANCELLED") {
        await failAndRefund(f, await loadItem(f.orderItemId), `Supplier reported eSIM ${order.lifecycle.toLowerCase()}`, "ESIM_" + order.lifecycle);
        continue;
      }
      await persistEsim(f, await loadItem(f.orderItemId), order);
      if (order.ready) completed++;
    } catch (err) {
      log.warn("eSIM sweep failed for fulfilment", { fulfilmentId: f.id, err });
    }
  }
  return completed;
}

/** Apply a verified esim.* supplier webhook. */
export async function applyEsimWebhook(order: EsimOrderInfo): Promise<void> {
  const f = await db.fulfilment.findFirst({ where: { supplierOrderRef: order.supplierOrderId } });
  if (!f) return;
  if (order.lifecycle === "FAILED" && f.status === "AWAITING_SUPPLIER") {
    await failAndRefund(f, await loadItem(f.orderItemId), "Supplier reported eSIM failure", "ESIM_FAILED");
    return;
  }
  if (f.status === "AWAITING_SUPPLIER" || f.status === "SUCCEEDED") await persistEsim(f, await loadItem(f.orderItemId), order);
}

/** Admin: put a reviewed/failed fulfilment back in the queue. */
export async function retryFulfilment(fulfilmentId: string, actor: { id: string; role: string }, reason: string): Promise<void> {
  const f = await db.fulfilment.findUniqueOrThrow({ where: { id: fulfilmentId } });
  if (!["NEEDS_REVIEW", "FAILED"].includes(f.status)) throw new Error("Only reviewed or failed fulfilments can be retried");
  const hasRefund = await db.refund.count({ where: { order: { items: { some: { id: f.orderItemId } } }, status: { in: ["REQUESTED", "PENDING", "COMPLETED"] } } });
  if (hasRefund > 0) throw new Error("This order already has a refund; it cannot be resubmitted");
  await db.$transaction(async (tx) => {
    await tx.fulfilment.update({ where: { id: f.id }, data: { status: "PENDING", lastError: null, lastErrorCode: null } });
    await enqueue(tx, { type: "fulfil-order-item", payload: { orderItemId: f.orderItemId }, dedupeKey: `fulfil:${f.orderItemId}:retry:${Date.now()}` });
    await writeAudit({ actorId: actor.id, actorRole: actor.role, action: "fulfilment.retry", entityType: "fulfilment", entityId: f.id, reason }, tx);
  });
}

/**
 * Admin, exceptional: link a fulfilment to an existing supplier order (e.g. after verifying an
 * uncertain submission with the supplier). The reference is fetched from the supplier and must
 * exist and match — an order can never be marked fulfilled without a real supplier result.
 */
export async function linkSupplierOrder(fulfilmentId: string, supplierRef: string, actor: { id: string; role: string }, reason: string): Promise<void> {
  const f = await db.fulfilment.findUniqueOrThrow({ where: { id: fulfilmentId } });
  if (!["NEEDS_REVIEW", "UNCERTAIN"].includes(f.status)) throw new Error("Only fulfilments under review can be linked manually");
  const item = await loadItem(f.orderItemId);
  const config = itemConfigurationSchema.parse(item.configuration);
  const adapter = getSupplierAdapter();
  await writeAudit({ actorId: actor.id, actorRole: actor.role, action: "fulfilment.manual_link", entityType: "fulfilment", entityId: f.id, reason, metadata: { supplierRef } });
  if (config.kind === "ESIM") {
    const order = await adapter.esim.getEsimOrder(supplierRef);
    if (order.packageCode !== config.packageCode) throw new Error("Supplier order does not match the purchased package");
    await persistEsim(f, item, order);
  } else if (config.kind === "VERIFICATION") {
    const a = await adapter.verification.getActivation(supplierRef);
    if (a.serviceSlug && a.serviceSlug !== config.serviceSlug) throw new Error("Supplier activation does not match the purchased service");
    await persistVerification(f, item, a);
  } else {
    const r = await adapter.rentals.getRental(supplierRef);
    if (r.term !== config.term) throw new Error("Supplier rental does not match the purchased term");
    await persistRental(f, item, r);
  }
}

export function supplierCostOf(cost: string | null | undefined): string {
  return cost ? dec(cost).toFixed(4) : "0.0000";
}
