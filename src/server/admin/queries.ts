import "server-only";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { OrderStatus as OrderStatusEnum } from "@/generated/prisma/enums";
import { db } from "@/server/db";

/** Staff read models with search and pagination. Callers must check permissions first. */

export const ADMIN_PAGE_SIZE = 25;

export interface ListParams {
  q?: string;
  page?: number;
  status?: string;
}

function paging(page = 1) {
  const p = Math.max(1, page);
  return { skip: (p - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE, page: p };
}

export function pages(total: number): number {
  return Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
}

const isOrderStatus = (s?: string): s is OrderStatus => !!s && (Object.values(OrderStatusEnum) as string[]).includes(s);

export async function adminOverview() {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [review, failedJobs, pendingRefunds, openTickets, todayOrders, failedWebhooks, uncertain, supplier, failedEmails] = await Promise.all([
    db.order.count({ where: { status: "NEEDS_REVIEW" } }),
    db.job.count({ where: { status: "DEAD", updatedAt: { gt: new Date(Date.now() - 7 * 86400000) } } }),
    db.refund.count({ where: { status: { in: ["REQUESTED", "PENDING"] } } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "AWAITING_STAFF"] } } }),
    db.order.count({ where: { paidAt: { gt: since } } }),
    db.webhookEvent.count({ where: { status: "FAILED", receivedAt: { gt: since } } }),
    db.fulfilment.count({ where: { status: "UNCERTAIN" } }),
    db.supplier.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" }, include: { balances: { orderBy: { capturedAt: "desc" }, take: 1 } } }),
    db.emailDelivery.count({ where: { status: "FAILED", createdAt: { gt: since } } }),
  ]);
  return { review, failedJobs, pendingRefunds, openTickets, todayOrders, failedWebhooks, uncertain, supplier, failedEmails };
}

export async function listOrders(params: ListParams) {
  const q = params.q?.trim();
  const where: Prisma.OrderWhereInput = {
    ...(isOrderStatus(params.status) ? { status: params.status } : { status: { not: "CREATED" } }),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { payments: { some: { reference: { contains: q, mode: "insensitive" } } } },
            { payments: { some: { gatewayTransactionId: q } } },
            { items: { some: { fulfilment: { supplierOrderRef: q } } } },
          ],
        }
      : {}),
  };
  const { skip, take, page } = paging(params.page);
  const [items, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { user: { select: { email: true } }, items: { select: { description: true, productType: true } } },
    }),
    db.order.count({ where }),
  ]);
  return { items, total, page };
}

export async function getOrderForStaff(id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      items: { include: { fulfilment: true, product: { select: { supplierProductCode: true, name: true } }, esims: { select: { id: true, iccid: true, status: true } }, verification: { select: { id: true, status: true, phoneNumber: true } }, rental: { select: { id: true, status: true, phoneNumber: true } } } },
      payments: true,
      refunds: { orderBy: { createdAt: "asc" } },
      history: { orderBy: { createdAt: "asc" } },
      ledgerEntries: { orderBy: { createdAt: "asc" } },
      promotion: { select: { code: true } },
    },
  });
}

export async function listUsers(params: ListParams) {
  const q = params.q?.trim();
  const where: Prisma.UserWhereInput = q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {};
  const { skip, take, page } = paging(params.page);
  const [items, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { _count: { select: { orders: true } }, profile: { select: { deletionRequestedAt: true } } } }),
    db.user.count({ where }),
  ]);
  return { items, total, page };
}

export async function listEsimsForStaff(params: ListParams) {
  const q = params.q?.trim();
  const where: Prisma.EsimActivationWhereInput = q ? { OR: [{ iccid: { contains: q } }, { supplierOrderRef: q }, { user: { email: { contains: q, mode: "insensitive" } } }] } : {};
  const { skip, take, page } = paging(params.page);
  const [items, total] = await Promise.all([
    db.esimActivation.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { email: true } }, orderItem: { select: { description: true, order: { select: { id: true, number: true } } } } } }),
    db.esimActivation.count({ where }),
  ]);
  return { items, total, page };
}

export async function listVerificationsForStaff(params: ListParams) {
  const q = params.q?.trim();
  const where: Prisma.VerificationActivationWhereInput = q ? { OR: [{ supplierOrderRef: q }, { phoneNumber: { contains: q } }, { user: { email: { contains: q, mode: "insensitive" } } }] } : {};
  const { skip, take, page } = paging(params.page);
  // Staff never see SMS content here — only counts (least privilege).
  const [items, total] = await Promise.all([
    db.verificationActivation.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { email: true } }, _count: { select: { messages: true } }, orderItem: { select: { order: { select: { id: true, number: true } } } } } }),
    db.verificationActivation.count({ where }),
  ]);
  return { items, total, page };
}

export async function listRentalsForStaff(params: ListParams) {
  const q = params.q?.trim();
  const where: Prisma.PhoneNumberRentalWhereInput = q ? { OR: [{ supplierNumberId: q }, { phoneNumber: { contains: q } }, { user: { email: { contains: q, mode: "insensitive" } } }] } : {};
  const { skip, take, page } = paging(params.page);
  const [items, total] = await Promise.all([
    db.phoneNumberRental.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { email: true } }, _count: { select: { messages: true } }, orderItem: { select: { order: { select: { id: true, number: true } } } } } }),
    db.phoneNumberRental.count({ where }),
  ]);
  return { items, total, page };
}

export async function listProducts(params: ListParams & { type?: string }) {
  const q = params.q?.trim();
  const where: Prisma.ProductWhereInput = {
    ...(params.type === "ESIM" || params.type === "VERIFICATION" || params.type === "RENTAL" ? { type: params.type } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { supplierProductCode: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const { skip, take, page } = paging(params.page);
  const [items, total] = await Promise.all([
    db.product.findMany({ where, orderBy: [{ type: "asc" }, { name: "asc" }], skip, take, include: { supplier: { select: { code: true } } } }),
    db.product.count({ where }),
  ]);
  return { items, total, page };
}

export async function listPayments(params: ListParams) {
  const q = params.q?.trim();
  const where: Prisma.PaymentWhereInput = q ? { OR: [{ reference: { contains: q, mode: "insensitive" } }, { gatewayTransactionId: q }, { order: { number: { contains: q, mode: "insensitive" } } }] } : {};
  const { skip, take, page } = paging(params.page);
  const [items, total] = await Promise.all([
    db.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { order: { select: { id: true, number: true, user: { select: { email: true } } } } } }),
    db.payment.count({ where }),
  ]);
  return { items, total, page };
}

export async function listRefunds(params: ListParams) {
  const where: Prisma.RefundWhereInput = params.status && ["REQUESTED", "PENDING", "COMPLETED", "FAILED", "REJECTED"].includes(params.status) ? { status: params.status as never } : {};
  const { skip, take, page } = paging(params.page);
  const [items, total] = await Promise.all([
    db.refund.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { order: { select: { id: true, number: true, user: { select: { email: true } } } } } }),
    db.refund.count({ where }),
  ]);
  return { items, total, page };
}

export async function listTickets(params: ListParams) {
  const where: Prisma.SupportTicketWhereInput = params.status ? { status: params.status as never } : { status: { in: ["OPEN", "AWAITING_STAFF", "AWAITING_CUSTOMER"] } };
  const { skip, take, page } = paging(params.page);
  const [items, total] = await Promise.all([
    db.supportTicket.findMany({ where, orderBy: [{ priority: "desc" }, { updatedAt: "asc" }], skip, take, include: { user: { select: { email: true } }, order: { select: { number: true } } } }),
    db.supportTicket.count({ where }),
  ]);
  return { items, total, page };
}

export async function getTicketForStaff(id: string) {
  return db.supportTicket.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } }, order: { select: { id: true, number: true, status: true } }, messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, email: true } } } } },
  });
}

export async function listAuditLogs(params: ListParams) {
  const q = params.q?.trim();
  const where: Prisma.AuditLogWhereInput = q ? { OR: [{ action: { contains: q } }, { entityId: q }, { actorId: q }] } : {};
  const { skip, take, page } = paging(params.page);
  const [items, total] = await Promise.all([db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }), db.auditLog.count({ where })]);
  return { items, total, page };
}

export async function integrationsStatus() {
  const [suppliers, lastSyncs, webhookStats, jobStats, emailStats] = await Promise.all([
    db.supplier.findMany({ include: { balances: { orderBy: { capturedAt: "desc" }, take: 1 } } }),
    db.catalogSyncLog.findMany({ orderBy: { startedAt: "desc" }, take: 15 }),
    db.webhookEvent.groupBy({ by: ["source", "status"], _count: true, where: { receivedAt: { gt: new Date(Date.now() - 7 * 86400000) } } }),
    db.job.groupBy({ by: ["type", "status"], _count: true, where: { updatedAt: { gt: new Date(Date.now() - 86400000) } } }),
    db.emailDelivery.groupBy({ by: ["status"], _count: true, where: { createdAt: { gt: new Date(Date.now() - 7 * 86400000) } } }),
  ]);
  return { suppliers, lastSyncs, webhookStats, jobStats, emailStats };
}
