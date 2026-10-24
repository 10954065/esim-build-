"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/server/audit";
import { auth } from "@/server/auth/auth";
import { assertUser } from "@/server/auth/session";
import { humanReference } from "@/server/crypto";
import { db } from "@/server/db";
import { clientIp } from "@/server/rate-limit";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{2})?$/, "Use a 2-letter country code")
    .optional(),
});

export async function updateProfileAction(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const user = await assertUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await auth.api.updateUser({ body: { name: parsed.data.name }, headers: await headers() });
  await db.userProfile.upsert({
    where: { userId: user.id },
    update: { countryCode: parsed.data.countryCode || null },
    create: { userId: user.id, countryCode: parsed.data.countryCode || null },
  });
  revalidatePath("/dashboard/profile");
  return { ok: true, message: "Profile updated." };
}

/**
 * Account deletion request. Personal data is deleted or anonymised by staff after checking
 * retention obligations (financial records, fraud prevention). A support ticket tracks it.
 */
export async function requestAccountDeletionAction(confirmText: string): Promise<ActionResult> {
  const user = await assertUser();
  if (confirmText !== "DELETE") return { ok: false, error: "Type DELETE to confirm." };
  const existing = await db.userProfile.findUnique({ where: { userId: user.id } });
  if (existing?.deletionRequestedAt) return { ok: true, message: "Your deletion request is already being processed." };

  await db.$transaction(async (tx) => {
    await tx.userProfile.upsert({
      where: { userId: user.id },
      update: { deletionRequestedAt: new Date() },
      create: { userId: user.id, deletionRequestedAt: new Date() },
    });
    const ticket = await tx.supportTicket.create({
      data: {
        number: humanReference("TCK"),
        userId: user.id,
        category: "DATA_DELETION",
        priority: "HIGH",
        subject: "Account deletion request",
        status: "AWAITING_STAFF",
      },
    });
    await tx.supportMessage.create({
      data: { ticketId: ticket.id, authorId: user.id, body: "I request deletion of my account and personal data." },
    });
    await writeAudit(
      { actorId: user.id, actorRole: user.role, action: "account.deletion_requested", entityType: "user", entityId: user.id, ipAddress: clientIp(await headers()) },
      tx,
    );
  });
  revalidatePath("/dashboard/profile");
  return { ok: true, message: "Deletion requested. We will confirm by email once it is complete." };
}
