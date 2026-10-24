"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TicketCategory } from "@/generated/prisma/enums";
import { assertUser } from "@/server/auth/session";
import { humanReference } from "@/server/crypto";
import { db } from "@/server/db";
import { consumeRateLimit } from "@/server/rate-limit";

export type TicketResult = { ok: true; ticketId: string } | { ok: false; error: string };

const createSchema = z.object({
  category: z.enum(Object.values(TicketCategory) as [TicketCategory, ...TicketCategory[]]),
  subject: z.string().trim().min(4, "Add a short subject").max(140),
  body: z.string().trim().min(10, "Describe the problem in a few words").max(5000),
  orderId: z.uuid().optional().or(z.literal("")),
});

const URGENT_CATEGORIES: TicketCategory[] = ["PAYMENT", "SUPPLIER_FAILURE", "ACCOUNT_SECURITY", "ABUSE_REPORT"];

export async function createTicketAction(input: z.input<typeof createSchema>): Promise<TicketResult> {
  const user = await assertUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const rl = await consumeRateLimit(`ticket:create:${user.id}`, 5, 3600);
  if (!rl.ok) return { ok: false, error: "You have opened several tickets recently. Please reply to an existing ticket." };

  let orderId: string | null = null;
  if (parsed.data.orderId) {
    // Only allow linking the customer's own orders.
    const order = await db.order.findFirst({ where: { id: parsed.data.orderId, userId: user.id }, select: { id: true } });
    if (!order) return { ok: false, error: "That order was not found on your account." };
    orderId = order.id;
  }

  const ticket = await db.supportTicket.create({
    data: {
      number: humanReference("TCK"),
      userId: user.id,
      orderId,
      category: parsed.data.category,
      priority: URGENT_CATEGORIES.includes(parsed.data.category) ? "HIGH" : "NORMAL",
      subject: parsed.data.subject,
      status: "AWAITING_STAFF",
      messages: { create: { authorId: user.id, body: parsed.data.body } },
    },
  });
  revalidatePath("/dashboard/support");
  return { ok: true, ticketId: ticket.id };
}

const replySchema = z.object({ ticketId: z.uuid(), body: z.string().trim().min(1).max(5000) });

export async function replyTicketAction(input: z.input<typeof replySchema>): Promise<TicketResult> {
  const user = await assertUser();
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Write a message before sending." };
  const rl = await consumeRateLimit(`ticket:reply:${user.id}`, 30, 3600);
  if (!rl.ok) return { ok: false, error: "Too many messages. Please wait a little." };

  const ticket = await db.supportTicket.findFirst({ where: { id: parsed.data.ticketId, userId: user.id }, select: { id: true, status: true } });
  if (!ticket) return { ok: false, error: "Ticket not found." };
  if (ticket.status === "CLOSED") return { ok: false, error: "This ticket is closed. Please open a new one." };

  await db.$transaction([
    db.supportMessage.create({ data: { ticketId: ticket.id, authorId: user.id, body: parsed.data.body } }),
    db.supportTicket.update({ where: { id: ticket.id }, data: { status: "AWAITING_STAFF" } }),
  ]);
  revalidatePath(`/dashboard/support/${ticket.id}`);
  return { ok: true, ticketId: ticket.id };
}
