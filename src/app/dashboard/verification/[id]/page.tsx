import { Inbox, Loader2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { AutoRefresh, CopyButton, Countdown } from "@/components/dashboard/client-utils";
import { VerificationActions } from "@/components/dashboard/verification-actions";
import { formatDateTime } from "@/lib/format";
import { flagEmoji } from "@/lib/slug";
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href={`/dashboard/orders/${v.orderItem.order.id}`} className="font-mono underline-offset-2 hover:underline">{v.orderItem.order.number}</Link>
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            {v.serviceName} · {flagEmoji(v.countryCode)} {v.countryCode} <DemoBadge show={v.isSandbox} />
          </h1>
        </div>
        <StatusBadge status={v.status} className="text-sm" />
      </div>

      <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Your number</p>
          <p className="mt-1 font-mono text-3xl font-semibold tracking-tight">{v.phoneNumber}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {live ? (
              <>Expires in <strong className="text-foreground"><Countdown until={v.expiresAt.toISOString()} /></strong> · {formatDateTime(v.expiresAt)}</>
            ) : (
              <>Session ended · {formatDateTime(v.completedAt ?? v.cancelledAt ?? v.expiresAt)}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={v.phoneNumber} label="Copy number" />
          <VerificationActions verificationId={v.id} canCancel={canCancel} live={live} sandbox={v.isSandbox} />
        </div>
      </section>

      <section aria-labelledby="messages" className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 id="messages" className="font-semibold">Messages</h2>
          <p className="text-xs text-muted-foreground">Last checked {formatDateTime(v.lastCheckedAt ?? v.updatedAt)}</p>
        </div>
        {v.messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center text-sm text-muted-foreground">
            {live ? <Loader2 className="size-6 animate-spin text-brand" aria-hidden /> : <Inbox className="size-6" aria-hidden />}
            <p>{live ? "Waiting for an SMS. Request the code from the service now — this page updates automatically." : "No messages were received for this number."}</p>
          </div>
        ) : (
          <ul className="divide-y" aria-live="polite">
            {v.messages.map((m) => (
              <li key={m.id} className="space-y-2 px-5 py-4">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>From {m.sender ?? "unknown sender"}</span>
                  <time dateTime={m.receivedAt.toISOString()}>{formatDateTime(m.receivedAt)}</time>
                </div>
                {m.code && (
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-brand-soft px-3 py-1.5 font-mono text-2xl font-semibold tracking-[0.2em] text-brand">{m.code}</span>
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
        Delivery depends on the service accepting this number and is not guaranteed. If no SMS arrives, cancel (when available) or let the
        session expire; eligible sessions are refunded automatically once the supplier confirms. See the{" "}
        <Link href="/refund-policy" className="underline">refund policy</Link>.
      </p>
    </div>
  );
}
