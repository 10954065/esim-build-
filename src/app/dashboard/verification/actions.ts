"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { consumeRateLimit } from "@/server/rate-limit";
import { isSandboxEnabled, simulateSandboxSms } from "@/server/sandbox/ops";
import { cancelVerification, refreshVerification } from "@/server/verification/service";

export type VerificationActionResult = { ok: true; message: string } | { ok: false; error: string };

const idSchema = z.uuid();

async function ownSession(userId: string, id: string) {
  if (!idSchema.safeParse(id).success) return null;
  return db.verificationActivation.findFirst({ where: { id, userId }, select: { id: true, status: true, supplierOrderRef: true, isSandbox: true, expiresAt: true } });
}

export async function refreshVerificationAction(id: string): Promise<VerificationActionResult> {
  const user = await assertUser();
  const v = await ownSession(user.id, id);
  if (!v) return { ok: false, error: "Session not found." };
  const rl = await consumeRateLimit(`verification-refresh:${user.id}`, 12, 60);
  if (!rl.ok) return { ok: false, error: "Please wait a few seconds before checking again." };
  try {
    await refreshVerification(v.id);
  } catch (err) {
    logger.warn("manual verification refresh failed", { verificationId: v.id, err });
    return { ok: false, error: "We could not reach the supplier. We will keep checking automatically." };
  }
  revalidatePath(`/dashboard/verification/${v.id}`);
  return { ok: true, message: "Checked for new messages." };
}

export async function cancelVerificationAction(id: string): Promise<VerificationActionResult> {
  const user = await assertUser();
  const rl = await consumeRateLimit(`verification-cancel:${user.id}`, 10, 3600);
  if (!rl.ok) return { ok: false, error: "Too many cancellations. Please contact support." };
  const result = await cancelVerification(user.id, id);
  revalidatePath(`/dashboard/verification/${id}`);
  if (!result.ok) return result;
  return { ok: true, message: result.refunded ? "Cancelled. Your refund has been started." : "Cancelled. The supplier did not issue a refund for this number." };
}

/** DEMO ONLY: simulate an incoming SMS on a sandbox verification session. */
export async function simulateSmsAction(id: string): Promise<VerificationActionResult> {
  const user = await assertUser();
  if (!isSandboxEnabled()) return { ok: false, error: "Not available." };
  const v = await ownSession(user.id, id);
  if (!v || !v.isSandbox) return { ok: false, error: "Session not found." };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await simulateSandboxSms({ kind: "activation", supplierRef: v.supplierOrderRef }, `Your demo verification code is ${code}`, code);
  revalidatePath(`/dashboard/verification/${v.id}`);
  return { ok: true, message: "Demo SMS delivered." };
}

/** DEMO ONLY: simulate an incoming SMS on a sandbox rental. */
export async function simulateRentalSmsAction(rentalId: string): Promise<VerificationActionResult> {
  const user = await assertUser();
  if (!isSandboxEnabled() || !idSchema.safeParse(rentalId).success) return { ok: false, error: "Not available." };
  const r = await db.phoneNumberRental.findFirst({ where: { id: rentalId, userId: user.id, isSandbox: true }, select: { id: true, supplierNumberId: true } });
  if (!r) return { ok: false, error: "Rental not found." };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await simulateSandboxSms({ kind: "rental", supplierRef: r.supplierNumberId }, `Demo message: your code is ${code}`, code);
  revalidatePath("/dashboard/rentals");
  return { ok: true, message: "Demo SMS delivered." };
}
