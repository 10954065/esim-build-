"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertUser } from "@/server/auth/session";
import { createCheckout } from "@/server/orders/checkout";
import { decideSandboxCharge } from "@/server/sandbox/ops";
import { db } from "@/server/db";

const checkoutSchema = z.object({
  productId: z.uuid(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  promoCode: z.string().trim().max(40).optional(),
  idempotencyKey: z.uuid(),
  acceptTerms: z.literal("on", { error: "Please accept the terms to continue." }),
});

export type CheckoutActionState = { error: string | null };

export async function createCheckoutAction(_prev: CheckoutActionState, formData: FormData): Promise<CheckoutActionState> {
  const user = await assertUser();
  const parsed = checkoutSchema.safeParse({
    productId: formData.get("productId"),
    days: formData.get("days") || undefined,
    promoCode: formData.get("promoCode") || undefined,
    idempotencyKey: formData.get("idempotencyKey"),
    acceptTerms: formData.get("acceptTerms"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid checkout request." };
  const result = await createCheckout({ userId: user.id, email: user.email, ...parsed.data });
  if (!result.ok) return { error: result.error };
  redirect(result.authorizationUrl);
}

/** Sandbox gateway page: the simulated customer approves or declines the test payment. */
export async function sandboxPayAction(formData: FormData): Promise<void> {
  const user = await assertUser();
  const reference = String(formData.get("reference") ?? "");
  const outcome = formData.get("outcome") === "failure" ? "failure" : "success";
  const payment = await db.payment.findFirst({ where: { reference, order: { userId: user.id } }, select: { reference: true } });
  if (!payment) redirect("/dashboard/orders");
  await decideSandboxCharge(payment.reference, outcome);
  redirect(`/checkout/return?reference=${encodeURIComponent(payment.reference)}`);
}
