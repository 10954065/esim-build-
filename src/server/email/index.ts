import "server-only";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";
import type { RenderedEmail } from "./templates";

/**
 * Transactional email delivery with a durable record per message (EmailDelivery).
 * - resend: POST https://api.resend.com/emails (server-side key)
 * - log: development only, stores the rendered body for the /dev/mailbox page.
 * Sends retry inline with backoff; final failures are recorded for staff review.
 */

const log = logger.child({ component: "email" });

export interface SendEmailInput {
  to: string;
  email: RenderedEmail;
  userId?: string | null;
  /** Prevents duplicate sends of the same logical notification. */
  dedupeKey?: string;
}

async function deliverViaProvider(to: string, email: RenderedEmail): Promise<{ providerMessageId: string | null }> {
  const env = getEnv();
  if (env.EMAIL_PROVIDER === "log") return { providerMessageId: null };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject: email.subject, html: email.html, text: email.text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Email provider returned HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return { providerMessageId: json.id ?? null };
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string; status: "SENT" | "FAILED" | "DUPLICATE" }> {
  const env = getEnv();
  if (input.dedupeKey) {
    const existing = await db.emailDelivery.findUnique({ where: { dedupeKey: input.dedupeKey } });
    if (existing) return { id: existing.id, status: "DUPLICATE" };
  }
  const record = await db.emailDelivery.create({
    data: {
      userId: input.userId ?? null,
      toAddress: input.to,
      template: input.email.template,
      subject: input.email.subject,
      provider: env.EMAIL_PROVIDER,
      dedupeKey: input.dedupeKey,
      // Only the development log provider keeps message bodies, for local testing.
      devPreview: env.EMAIL_PROVIDER === "log" && env.APP_ENV !== "production" ? input.email.html : null,
    },
  });
  return attemptDelivery(record.id, input.to, input.email);
}

const RETRY_DELAYS_MS = [0, 750, 2500];

/**
 * Deliver with bounded inline retries. Message bodies are not persisted in production
 * (they can contain one-time links), so a message that still fails after all attempts is
 * recorded as FAILED with the error and surfaced to staff in the admin dashboard.
 */
async function attemptDelivery(id: string, to: string, email: RenderedEmail): Promise<{ id: string; status: "SENT" | "FAILED" }> {
  let lastError = "unknown error";
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const { providerMessageId } = await deliverViaProvider(to, email);
      await db.emailDelivery.update({
        where: { id },
        data: { status: "SENT", providerMessageId, sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
      });
      return { id, status: "SENT" };
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 500) : "unknown error";
      await db.emailDelivery.update({ where: { id }, data: { attempts: { increment: 1 }, lastError } });
    }
  }
  await db.emailDelivery.update({ where: { id }, data: { status: "FAILED", lastError } });
  log.warn("email delivery failed after retries", { emailId: id, template: email.template });
  return { id, status: "FAILED" };
}
