"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createTicketAction, replyTicketAction } from "@/app/dashboard/support/actions";
import { Field } from "@/components/account/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = [
  ["PAYMENT", "Payment problem"],
  ["ESIM_INSTALLATION", "eSIM installation"],
  ["UNSUPPORTED_DEVICE", "Unsupported device"],
  ["MISSING_SMS", "Missing SMS"],
  ["NUMBER_EXPIRATION", "Number expired"],
  ["SUPPLIER_FAILURE", "Order not delivered"],
  ["REFUND_REQUEST", "Refund request"],
  ["ACCOUNT_SECURITY", "Account & security"],
  ["ABUSE_REPORT", "Report abuse"],
  ["OTHER", "Something else"],
] as const;

export function NewTicketForm({ orders, defaultOrderId }: { orders: Array<{ id: string; label: string }>; defaultOrderId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    category: "OTHER" as (typeof CATEGORIES)[number][0],
    subject: "",
    body: "",
    orderId: orders.some((o) => o.id === defaultOrderId) ? (defaultOrderId ?? "") : "",
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createTicketAction(form);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Ticket opened. We will reply here and by email.");
          router.push(`/dashboard/support/${r.ticketId}`);
        });
      }}
    >
      <Field id="category" label="What do you need help with?">
        <select
          id="category"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as typeof f.category }))}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          {CATEGORIES.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Field>
      <Field id="order" label="Related order (optional)">
        <select id="order" value={form.orderId} onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">No specific order</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </Field>
      <Field id="subject" label="Subject">
        <Input id="subject" value={form.subject} maxLength={140} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required />
      </Field>
      <Field id="body" label="Details" hint="Never include passwords or full card numbers.">
        <Textarea id="body" rows={6} value={form.body} maxLength={5000} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} required />
      </Field>
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Open ticket</Button>
    </form>
  );
}

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await replyTicketAction({ ticketId, body });
          if (!r.ok) return void toast.error(r.error);
          setBody("");
          router.refresh();
        });
      }}
    >
      <label htmlFor="reply" className="sr-only">Reply</label>
      <Textarea id="reply" rows={4} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply…" required />
      <Button type="submit" disabled={pending || !body.trim()}>{pending && <Loader2 className="animate-spin" />} Send reply</Button>
    </form>
  );
}
