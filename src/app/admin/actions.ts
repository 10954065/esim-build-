"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/safe-redirect";
import { writeAudit } from "@/server/audit";
import type { Permission } from "@/server/auth/permissions";
import { assertPermission, type SessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { templates } from "@/server/email/templates";
import { linkSupplierOrder, retryFulfilment } from "@/server/fulfilment/service";
import { kickJobs } from "@/server/jobs/kick";
import { enqueue } from "@/server/jobs/queue";
import { logger } from "@/server/logger";
import { dec, toDbAmount } from "@/server/pricing/money";
import { clientIp } from "@/server/rate-limit";
import { requestRefund } from "@/server/refunds/service";
import { SETTINGS, setSetting, type SettingKey } from "@/server/settings";

/**
 * Staff actions. Every action: checks a specific permission on the server, validates input,
 * records an audit entry (with the staff member's reason where it matters) and redirects back.
 */

function backTo(fd: FormData, params: Record<string, string>): never {
  const base = safeNextPath(String(fd.get("back") ?? ""), "/admin");
  const url = new URL(base, "http://x.invalid");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  redirect(url.pathname + url.search);
}

async function run(fd: FormData, permission: Permission, fn: (user: SessionUser, ip: string) => Promise<string>): Promise<never> {
  let notice: string;
  try {
    const user = await assertPermission(permission);
    notice = await fn(user, clientIp(await headers()));
  } catch (err) {
    logger.warn("admin action failed", { permission, err });
    backTo(fd, { error: err instanceof Error ? err.message.slice(0, 200) : "Action failed" });
  }
  revalidatePath("/admin", "layout");
  backTo(fd, { notice });
}

const reasonSchema = z.string().trim().min(5, "A reason of at least 5 characters is required").max(300);
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ───────────── Orders & fulfilment ─────────────

export async function retryFulfilmentAction(fd: FormData) {
  return run(fd, "orders.manage", async (user) => {
    await retryFulfilment(z.uuid().parse(str(fd, "fulfilmentId")), user, reasonSchema.parse(str(fd, "reason")));
    kickJobs();
    return "Fulfilment queued again.";
  });
}

export async function linkSupplierOrderAction(fd: FormData) {
  return run(fd, "orders.manual_fulfil", async (user) => {
    const ref = z.string().trim().min(3).max(200).parse(str(fd, "supplierRef"));
    await linkSupplierOrder(z.uuid().parse(str(fd, "fulfilmentId")), ref, user, reasonSchema.parse(str(fd, "reason")));
    return "Supplier order verified and linked.";
  });
}

export async function staffRefundAction(fd: FormData) {
  return run(fd, "refunds.manage", async (user) => {
    const orderId = z.uuid().parse(str(fd, "orderId"));
    const amountRaw = str(fd, "amount");
    const amount = amountRaw ? z.string().regex(/^\d+(\.\d{1,4})?$/, "Invalid amount").parse(amountRaw) : undefined;
    const nonce = z.uuid().parse(str(fd, "nonce"));
    await requestRefund({ orderId, amount, reason: reasonSchema.parse(str(fd, "reason")), initiatedByType: "STAFF", initiatedById: user.id, idempotencyKey: `staff:${nonce}` });
    kickJobs();
    return "Refund requested. It completes when the payment provider confirms it.";
  });
}

// ───────────── Users ─────────────

export async function setUserRoleAction(fd: FormData) {
  return run(fd, "users.manage", async (user, ip) => {
    const userId = z.string().min(1).parse(str(fd, "userId"));
    const role = z.enum(["user", "support", "finance", "admin"]).parse(str(fd, "role"));
    const reason = reasonSchema.parse(str(fd, "reason"));
    if (userId === user.id) throw new Error("You cannot change your own role.");
    const before = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { role } }),
      db.session.deleteMany({ where: { userId } }), // apply immediately
    ]);
    await writeAudit({ actorId: user.id, actorRole: user.role, action: "user.role_changed", entityType: "user", entityId: userId, reason, ipAddress: ip, metadata: { from: before.role, to: role } });
    return `Role changed to ${role}.`;
  });
}

export async function setUserBanAction(fd: FormData) {
  return run(fd, "users.manage", async (user, ip) => {
    const userId = z.string().min(1).parse(str(fd, "userId"));
    const ban = str(fd, "ban") === "true";
    const reason = reasonSchema.parse(str(fd, "reason"));
    if (userId === user.id) throw new Error("You cannot suspend your own account.");
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { banned: ban, banReason: ban ? reason : null } }),
      ...(ban ? [db.session.deleteMany({ where: { userId } })] : []),
    ]);
    await writeAudit({ actorId: user.id, actorRole: user.role, action: ban ? "user.suspended" : "user.reinstated", entityType: "user", entityId: userId, reason, ipAddress: ip });
    return ban ? "Account suspended." : "Account reinstated.";
  });
}

// ───────────── Catalogue ─────────────

async function toggle(fd: FormData, entity: "product" | "country" | "service" | "destination") {
  return run(fd, "catalog.manage", async (user, ip) => {
    const id = z.uuid().parse(str(fd, "id"));
    const value = str(fd, "value") === "true";
    if (entity === "product") await db.product.update({ where: { id }, data: { isVisible: value } });
    if (entity === "country") await db.country.update({ where: { id }, data: { isEnabled: value } });
    if (entity === "service") await db.service.update({ where: { id }, data: { isEnabled: value } });
    if (entity === "destination") await db.esimDestination.update({ where: { id }, data: { isEnabled: value } });
    await writeAudit({ actorId: user.id, actorRole: user.role, action: `catalog.${entity}_${value ? "enabled" : "disabled"}`, entityType: entity, entityId: id, ipAddress: ip });
    return `${entity[0]!.toUpperCase()}${entity.slice(1)} ${value ? "enabled" : "disabled"}.`;
  });
}
export const toggleProductAction = async (fd: FormData) => toggle(fd, "product");
export const toggleCountryAction = async (fd: FormData) => toggle(fd, "country");
export const toggleServiceAction = async (fd: FormData) => toggle(fd, "service");
export const toggleDestinationAction = async (fd: FormData) => toggle(fd, "destination");

export async function syncCatalogAction(fd: FormData) {
  return run(fd, "catalog.manage", async (user) => {
    await enqueue(db, [
      { type: "catalog.sync", dedupeKey: `catalog.sync:manual:${Math.floor(Date.now() / 60000)}` },
      { type: "supplier.balance", dedupeKey: `supplier.balance:manual:${Math.floor(Date.now() / 60000)}` },
    ]);
    await writeAudit({ actorId: user.id, actorRole: user.role, action: "catalog.sync_requested", entityType: "supplier" });
    kickJobs(5);
    return "Catalogue sync and balance check queued.";
  });
}

// ───────────── Pricing ─────────────

const decimalField = z.string().trim().regex(/^-?\d+(\.\d{1,4})?$/, "Use a decimal number");

export async function createPricingRuleAction(fd: FormData) {
  return run(fd, "pricing.manage", async (user, ip) => {
    const productType = str(fd, "productType");
    const scopeId = (k: string) => (str(fd, k) ? z.uuid().parse(str(fd, k)) : null);
    const data = {
      name: z.string().trim().min(3).max(100).parse(str(fd, "name")),
      productType: productType ? z.enum(["ESIM", "VERIFICATION", "RENTAL"]).parse(productType) : null,
      countryId: scopeId("countryId"),
      destinationId: scopeId("destinationId"),
      serviceId: scopeId("serviceId"),
      productId: scopeId("productId"),
      markupPercent: decimalField.parse(str(fd, "markupPercent") || "0"),
      markupFixed: decimalField.parse(str(fd, "markupFixed") || "0"),
      minProfit: str(fd, "minProfit") ? decimalField.parse(str(fd, "minProfit")) : null,
      fixedPrice: str(fd, "fixedPrice") ? decimalField.parse(str(fd, "fixedPrice")) : null,
      currency: z.string().length(3).toUpperCase().parse(str(fd, "currency")),
      priority: z.coerce.number().int().min(-100).max(100).parse(str(fd, "priority") || "0"),
      createdById: user.id,
    };
    if (dec(data.markupPercent).lt(-50) || dec(data.markupPercent).gt(1000)) throw new Error("Markup percent must be between -50 and 1000.");
    if (data.fixedPrice !== null && dec(data.fixedPrice).lte(0)) throw new Error("A fixed price must be more than zero.");
    const rule = await db.pricingRule.create({ data });
    await writeAudit({ actorId: user.id, actorRole: user.role, action: "pricing.rule_created", entityType: "pricingRule", entityId: rule.id, ipAddress: ip, metadata: { ...data } });
    return "Pricing rule created.";
  });
}

export async function setPricingRuleActiveAction(fd: FormData) {
  return run(fd, "pricing.manage", async (user, ip) => {
    const id = z.uuid().parse(str(fd, "id"));
    const active = str(fd, "value") === "true";
    await db.pricingRule.update({ where: { id }, data: { isActive: active } });
    await writeAudit({ actorId: user.id, actorRole: user.role, action: active ? "pricing.rule_activated" : "pricing.rule_deactivated", entityType: "pricingRule", entityId: id, ipAddress: ip });
    return active ? "Rule activated." : "Rule deactivated.";
  });
}

export async function createExchangeRateAction(fd: FormData) {
  return run(fd, "pricing.manage", async (user, ip) => {
    const base = z.string().length(3).toUpperCase().parse(str(fd, "base"));
    const quote = z.string().length(3).toUpperCase().parse(str(fd, "quote"));
    if (base === quote) throw new Error("Base and quote currencies must differ.");
    const rate = z.string().regex(/^\d+(\.\d{1,10})?$/, "Invalid rate").parse(str(fd, "rate"));
    if (dec(rate).lte(0)) throw new Error("Rate must be positive.");
    const source = z.string().trim().min(3, "State where the rate came from").max(200).parse(str(fd, "source"));
    const row = await db.exchangeRate.create({ data: { baseCurrency: base, quoteCurrency: quote, rate, source, createdById: user.id } });
    await writeAudit({ actorId: user.id, actorRole: user.role, action: "pricing.exchange_rate_added", entityType: "exchangeRate", entityId: row.id, ipAddress: ip, metadata: { base, quote, rate, source } });
    return `Rate ${base}→${quote} recorded.`;
  });
}

export async function createPromotionAction(fd: FormData) {
  return run(fd, "pricing.manage", async (user, ip) => {
    const percentOff = str(fd, "percentOff");
    const amountOff = str(fd, "amountOff");
    if (!percentOff === !amountOff) throw new Error("Set either a percentage or a fixed amount.");
    const data = {
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, "Code: 3 to 40 letters, numbers, hyphens or underscores").parse(str(fd, "code")),
      description: str(fd, "description").slice(0, 200) || null,
      percentOff: percentOff ? decimalField.parse(percentOff) : null,
      amountOff: amountOff ? toDbAmount(decimalField.parse(amountOff)) : null,
      currency: amountOff ? z.string().length(3).toUpperCase().parse(str(fd, "currency")) : null,
      maxRedemptions: str(fd, "maxRedemptions") ? z.coerce.number().int().min(1).parse(str(fd, "maxRedemptions")) : null,
      endsAt: str(fd, "endsAt") ? new Date(str(fd, "endsAt")) : null,
    };
    if (data.percentOff && (dec(data.percentOff).lte(0) || dec(data.percentOff).gt(90))) throw new Error("Percentage must be between 0 and 90.");
    const promo = await db.promotion.create({ data });
    await writeAudit({ actorId: user.id, actorRole: user.role, action: "pricing.promotion_created", entityType: "promotion", entityId: promo.id, ipAddress: ip, metadata: { code: data.code } });
    return `Promotion ${data.code} created.`;
  });
}

export async function setPromotionActiveAction(fd: FormData) {
  return run(fd, "pricing.manage", async (user) => {
    const id = z.uuid().parse(str(fd, "id"));
    const active = str(fd, "value") === "true";
    await db.promotion.update({ where: { id }, data: { isActive: active } });
    await writeAudit({ actorId: user.id, actorRole: user.role, action: active ? "pricing.promotion_activated" : "pricing.promotion_deactivated", entityType: "promotion", entityId: id });
    return active ? "Promotion activated." : "Promotion deactivated.";
  });
}

// ───────────── Support ─────────────

export async function staffReplyAction(fd: FormData) {
  return run(fd, "support.manage", async (user) => {
    const ticketId = z.uuid().parse(str(fd, "ticketId"));
    const body = z.string().trim().min(1).max(5000).parse(str(fd, "body"));
    const internal = str(fd, "internal") === "on";
    const ticket = await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId }, include: { user: { select: { email: true, name: true } } } });
    await db.$transaction([
      db.supportMessage.create({ data: { ticketId, authorId: user.id, body, isStaff: true, isInternal: internal } }),
      ...(internal ? [] : [db.supportTicket.update({ where: { id: ticketId }, data: { status: "AWAITING_CUSTOMER" } })]),
    ]);
    if (!internal) {
      await sendEmail({ to: ticket.user.email, userId: ticket.userId, email: templates.ticketUpdate({ name: ticket.user.name, ticketNumber: ticket.number, ticketId }) });
    }
    return internal ? "Internal note added." : "Reply sent.";
  });
}

export async function setTicketStatusAction(fd: FormData) {
  return run(fd, "support.manage", async (user) => {
    const ticketId = z.uuid().parse(str(fd, "ticketId"));
    const status = z.enum(["OPEN", "AWAITING_CUSTOMER", "AWAITING_STAFF", "RESOLVED", "CLOSED"]).parse(str(fd, "status"));
    await db.supportTicket.update({ where: { id: ticketId }, data: { status, closedAt: status === "CLOSED" ? new Date() : null } });
    await writeAudit({ actorId: user.id, actorRole: user.role, action: "support.status_changed", entityType: "supportTicket", entityId: ticketId, metadata: { status } });
    return "Ticket updated.";
  });
}

// ───────────── Settings & operations ─────────────

export async function updateSettingAction(fd: FormData) {
  return run(fd, "settings.manage", async (user, ip) => {
    const key = str(fd, "key") as SettingKey;
    if (!(key in SETTINGS)) throw new Error("Unknown setting.");
    const raw = str(fd, "value");
    const def = SETTINGS[key].default;
    const value = typeof def === "boolean" ? raw === "true" : typeof def === "number" ? Number(raw) : raw;
    const saved = await setSetting(key, value, user.id);
    await writeAudit({ actorId: user.id, actorRole: user.role, action: "settings.updated", entityType: "setting", entityId: key, ipAddress: ip, metadata: { value: saved } });
    return "Setting saved.";
  });
}

export async function retryDeadJobAction(fd: FormData) {
  return run(fd, "settings.manage", async (user) => {
    const id = z.uuid().parse(str(fd, "jobId"));
    const job = await db.job.findUniqueOrThrow({ where: { id } });
    if (job.status !== "DEAD") throw new Error("Only dead jobs can be retried.");
    await db.job.update({ where: { id }, data: { status: "PENDING", attempts: 0, runAt: new Date(), lastError: null, completedAt: null } });
    await writeAudit({ actorId: user.id, actorRole: user.role, action: "jobs.retried", entityType: "job", entityId: id, metadata: { type: job.type } });
    kickJobs(3);
    return "Job queued again.";
  });
}
