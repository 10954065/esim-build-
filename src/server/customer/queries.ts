import "server-only";
import QRCode from "qrcode";
import { z } from "zod";
import { decryptOptional, decryptField } from "@/server/crypto";
import { db } from "@/server/db";

/**
 * Customer read models. EVERY query is scoped by the authenticated user's id; detail
 * lookups use findFirst({ id, userId }) so another customer's id simply returns null (→ 404).
 */

const uuid = z.uuid();
export function isUuid(value: string): boolean {
  return uuid.safeParse(value).success;
}

export async function getDashboardSummary(userId: string) {
  const now = new Date();
  const [totalOrders, activeEsims, pendingOrders, activeVerifications, activeRentals, recentOrders, notifications] = await Promise.all([
    db.order.count({ where: { userId, status: { notIn: ["CREATED", "CANCELLED"] } } }),
    db.esimActivation.count({ where: { userId, status: { in: ["READY", "ACTIVE"] } } }),
    db.order.count({ where: { userId, status: { in: ["PAID", "FULFILLING", "NEEDS_REVIEW"] } } }),
    db.verificationActivation.count({ where: { userId, status: { in: ["WAITING", "RECEIVED"] }, expiresAt: { gt: now } } }),
    db.phoneNumberRental.count({ where: { userId, status: "ACTIVE", expiresAt: { gt: now } } }),
    db.order.findMany({
      where: { userId, status: { not: "CREATED" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, number: true, status: true, total: true, currency: true, createdAt: true, isSandbox: true, items: { select: { description: true }, take: 1 } },
    }),
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  return { totalOrders, activeEsims, pendingOrders, activeVerifications, activeRentals, recentOrders, notifications };
}

const PAGE_SIZE = 20;

export async function listOrders(userId: string, page = 1) {
  const where = { userId, status: { not: "CREATED" as const } };
  const [items, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        currency: true,
        createdAt: true,
        isSandbox: true,
        items: { select: { description: true, productType: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getOrder(userId: string, orderId: string) {
  if (!isUuid(orderId)) return null;
  return db.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: {
        include: {
          fulfilment: { select: { status: true, updatedAt: true } },
          esims: { select: { id: true, status: true } },
          verification: { select: { id: true, status: true } },
          rental: { select: { id: true, status: true } },
        },
      },
      payments: { orderBy: { createdAt: "asc" }, select: { id: true, provider: true, reference: true, status: true, amount: true, currency: true, paidAt: true, createdAt: true, failureReason: true } },
      refunds: { orderBy: { createdAt: "asc" }, select: { id: true, amount: true, currency: true, status: true, reason: true, createdAt: true, completedAt: true } },
      history: { orderBy: { createdAt: "asc" }, select: { id: true, toStatus: true, reason: true, createdAt: true, actorType: true } },
    },
  });
}

export async function listEsims(userId: string) {
  return db.esimActivation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      iccid: true,
      createdAt: true,
      expiresAt: true,
      isSandbox: true,
      orderItem: { select: { description: true, order: { select: { number: true } } } },
    },
  });
}

/** Full eSIM detail including decrypted activation data — owner only. */
export async function getEsim(userId: string, id: string) {
  if (!isUuid(id)) return null;
  const esim = await db.esimActivation.findFirst({
    where: { id, userId },
    include: {
      orderItem: {
        select: {
          description: true,
          configuration: true,
          product: { select: { dataLabel: true, validityDays: true, speed: true, fupPolicy: true, pricingUnit: true, destination: { select: { name: true, slug: true } } } },
          order: { select: { id: true, number: true } },
        },
      },
    },
  });
  if (!esim) return null;
  const activationCode = decryptOptional(esim.activationCodeEnc);
  const qrDataUrl = activationCode
    ? await QRCode.toDataURL(activationCode, { errorCorrectionLevel: "M", margin: 1, width: 320 })
    : null;
  return { ...esim, activationCode, qrDataUrl };
}

export async function listVerifications(userId: string) {
  return db.verificationActivation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      phoneNumber: true,
      countryCode: true,
      serviceName: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      isSandbox: true,
      _count: { select: { messages: true } },
    },
  });
}

export interface DecryptedMessage {
  id: string;
  sender: string | null;
  text: string;
  code: string | null;
  receivedAt: Date;
}

function decryptMessages(rows: Array<{ id: string; sender: string | null; bodyEnc: string; codeEnc: string | null; receivedAt: Date }>): DecryptedMessage[] {
  return rows.map((m) => ({ id: m.id, sender: m.sender, text: decryptField(m.bodyEnc), code: decryptOptional(m.codeEnc), receivedAt: m.receivedAt }));
}

export async function getVerification(userId: string, id: string) {
  if (!isUuid(id)) return null;
  const v = await db.verificationActivation.findFirst({
    where: { id, userId },
    include: {
      messages: { orderBy: { receivedAt: "asc" }, select: { id: true, sender: true, bodyEnc: true, codeEnc: true, receivedAt: true } },
      orderItem: { select: { order: { select: { id: true, number: true, status: true, currency: true, total: true } } } },
    },
  });
  if (!v) return null;
  return { ...v, messages: decryptMessages(v.messages) };
}

export async function listRentals(userId: string) {
  const rentals = await db.phoneNumberRental.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      messages: { orderBy: { receivedAt: "desc" }, take: 20, select: { id: true, sender: true, bodyEnc: true, codeEnc: true, receivedAt: true } },
      orderItem: { select: { order: { select: { id: true, number: true } } } },
    },
  });
  return rentals.map((r) => ({ ...r, messages: decryptMessages(r.messages) }));
}

export async function listPayments(userId: string) {
  return db.payment.findMany({
    where: { order: { userId } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      provider: true,
      reference: true,
      status: true,
      amount: true,
      currency: true,
      channel: true,
      paidAt: true,
      createdAt: true,
      order: { select: { id: true, number: true, isSandbox: true } },
    },
  });
}

export async function listRefunds(userId: string) {
  return db.refund.findMany({
    where: { order: { userId } },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true, currency: true, status: true, reason: true, createdAt: true, completedAt: true, order: { select: { id: true, number: true } } },
  });
}

export async function listTickets(userId: string) {
  return db.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, number: true, subject: true, status: true, category: true, updatedAt: true, order: { select: { number: true } } },
  });
}

export async function getTicket(userId: string, id: string) {
  if (!isUuid(id)) return null;
  return db.supportTicket.findFirst({
    where: { id, userId },
    include: {
      order: { select: { id: true, number: true } },
      // Internal staff notes are never returned to customers.
      messages: { where: { isInternal: false }, orderBy: { createdAt: "asc" }, select: { id: true, body: true, isStaff: true, createdAt: true, author: { select: { name: true } } } },
    },
  });
}

export async function listOrdersForSupport(userId: string) {
  return db.order.findMany({
    where: { userId, status: { not: "CREATED" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, number: true, createdAt: true, items: { select: { description: true }, take: 1 } },
  });
}
