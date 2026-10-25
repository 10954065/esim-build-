import { Clock, Inbox, Loader2, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { Flag } from "@/components/common/flag";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { AutoRefresh, CopyButton, Countdown } from "@/components/dashboard/client-utils";
import { VerificationActions } from "@/components/dashboard/verification-actions";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getVerification } from "@/server/customer/queries";

export const metadata = { title: "Verification session" };

export default async function VerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/verification/${id}`);
  const v = await getVerification(user.id, id);
  if (!v) notFound();
  const live = (v.status === "WAITING" || v.status === "RECEIVED") && v.expiresAt > new Date();
  const canCancel = v.status === "WAITING" && v.messages.length === 0 && v.expiresAt > new Date();

  return (
    <div className="space-y-6">
      <AutoRefresh active={live} seconds={6} />
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Verification numbers", href: "/dashboard/verification" }, { label: v.serviceName }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Flag code={v.countryCode} size="lg" className="mt-1" />
          <div>
            <p className="eyebrow">SMS verification</p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {v.serviceName} <DemoBadge show={v.isSandbox} />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {v.countryCode} number · Order{" "}
              <Link href={`/dashboard/orders/${v.orderItem.order.id}`} className="font-mono text-foreground underline-offset-2 hover:text-primary hover:underline">
                {v.orderItem.order.number}
              </Link>
            </p>
          </div>
        </div>
        <StatusBadge status={v.status} className="text-sm" />
      </div>

      <section aria-label="Your number" className="surface relative overflow-hidden p-6">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Your number</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-tight break-all sm:text-4xl">{v.phoneNumber}</p>
            <p className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              {live ? (
                <>
                  Expires in{" "}
                  <strong className="text-foreground tabular-nums">
                    <Countdown until={v.expiresAt.toISOString()} />
                  </strong>{" "}
                  · {formatDateTime(v.expiresAt)}
                </>
              ) : (
                <>Session ended · {formatDateTime(v.completedAt ?? v.cancelledAt ?? v.expiresAt)}</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={v.phoneNumber} label="Copy number" />
            <VerificationActions verificationId={v.id} canCancel={canCancel} live={live} sandbox={v.isSandbox} />
          </div>
        </div>
      </section>

      <section aria-labelledby="messages" className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
          <h2 id="messages" className="flex items-center gap-2 font-semibold">
            <MessageSquareText className="size-4 text-primary" aria-hidden /> Messages
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{v.messages.length}</span>
          </h2>
          <p className="text-xs text-muted-foreground">Last checked {formatDateTime(v.lastCheckedAt ?? v.updatedAt)}</p>
        </div>
        {v.messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center text-sm text-muted-foreground">
            <span className="grid size-12 place-items-center rounded-full bg-accent text-primary">
              {live ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Inbox className="size-5" aria-hidden />}
            </span>
            <p className="max-w-sm">
              {live ? "Waiting for an SMS. Request the code from the service now — this page updates automatically." : "No messages were received for this number."}
            </p>
          </div>
        ) : (
          <ul className="divide-y" aria-live="polite">
            {v.messages.map((m) => (
              <li key={m.id} className="space-y-3 px-5 py-4">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">From {m.sender ?? "unknown sender"}</span>
                  <time dateTime={m.receivedAt.toISOString()}>{formatDateTime(m.receivedAt)}</time>
                </div>
                {m.code && (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-xl border border-primary/15 bg-accent px-4 py-2 font-mono text-3xl font-bold tracking-[0.2em] text-primary">{m.code}</span>
                    <CopyButton value={m.code} label="Copy code" />
                  </div>
                )}
                <p className="text-sm">{m.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Delivery depends on the service accepting this number and is not guaranteed. If no SMS arrives, cancel (when available) or let the session
        expire; eligible sessions are refunded automatically once the supplier confirms. See the{" "}
        <Link href="/refund-policy" className="font-medium text-primary hover:underline">
          refund policy
        </Link>
        .
      </p>
    </div>
  );
}
