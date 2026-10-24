import { AlertTriangle, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { AutoRefresh } from "@/components/dashboard/client-utils";
import { EsimInstallPanel } from "@/components/dashboard/esim-install";
import { formatBytes } from "@/lib/currency";
import { appleInstallLink, isDemoActivation, parseLpa } from "@/lib/esim";
import { formatDateTime, formatValidity } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getEsim } from "@/server/customer/queries";

export const metadata = { title: "eSIM installation" };

export default async function EsimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/esims/${id}`);
  const esim = await getEsim(user.id, id);
  if (!esim) notFound();

  const product = esim.orderItem.product;
  const lpa = parseLpa(esim.activationCode);
  const demo = esim.isSandbox || isDemoActivation(esim.activationCode);
  const used = esim.usedVolumeBytes;
  const total = esim.totalVolumeBytes;
  const usagePct = used !== null && total ? Math.min(100, Number((used * BigInt(1000)) / total) / 10) : null;

  return (
    <div className="space-y-6">
      <AutoRefresh active={esim.status === "PREPARING"} seconds={8} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href={`/dashboard/orders/${esim.orderItem.order.id}`} className="font-mono underline-offset-2 hover:underline">{esim.orderItem.order.number}</Link>
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">{esim.orderItem.description} <DemoBadge show={demo} /></h1>
        </div>
        <StatusBadge status={esim.status} className="text-sm" />
      </div>

      {demo && (
        <div role="note" className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p>This is a <strong>demo eSIM</strong> from the sandbox supplier. Its activation code points to a non-existent server and cannot be installed.</p>
        </div>
      )}

      {esim.status === "PREPARING" || !esim.activationCode ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-6 text-sm">
          <Loader2 className="size-5 animate-spin text-brand" aria-hidden />
          <p>Your eSIM is being prepared by our supplier. This page updates automatically when the activation details are ready.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border bg-card p-5 text-center">
            {esim.qrDataUrl && (
              <Image
                src={esim.qrDataUrl}
                alt="eSIM installation QR code"
                width={280}
                height={280}
                unoptimized
                className="mx-auto rounded-lg bg-white p-2"
              />
            )}
            <p className="mt-3 text-xs text-muted-foreground">Scan this from another device. Do not share it — anyone with this code may be able to install your eSIM.</p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="mb-4 font-semibold">How to install</h2>
            <EsimInstallPanel
              smdpAddress={lpa?.smdpAddress ?? null}
              matchingId={lpa?.matchingId ?? null}
              activationCode={esim.activationCode}
              appleLink={!demo ? appleInstallLink(esim.activationCode) : null}
            />
          </div>
        </div>
      )}

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">Plan details</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">Coverage</dt><dd>{product.destination?.name ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Data</dt><dd>{product.dataLabel ?? formatBytes(total)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Validity</dt><dd>{formatValidity(product.validityDays)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Network</dt><dd>{product.speed ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">ICCID</dt><dd className="font-mono text-xs">{esim.iccid ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">APN</dt><dd className="font-mono text-xs">{esim.apn ?? "Automatic"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Activated</dt><dd>{formatDateTime(esim.activatedAt)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Expires</dt><dd>{formatDateTime(esim.expiresAt)}</dd></div>
        </dl>
        {usagePct !== null && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Data used (as reported by supplier)</span>
              <span>{formatBytes(used)} of {formatBytes(total)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={usagePct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand" style={{ width: `${usagePct}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Last updated {formatDateTime(esim.lastRefreshedAt ?? esim.updatedAt)}</p>
          </div>
        )}
        {product.fupPolicy && <p className="mt-4 text-xs text-muted-foreground">Fair use after allowance: {product.fupPolicy}</p>}
        <p className="mt-4 text-xs text-muted-foreground">Top-ups are not available for this plan. Need help? <Link href={`/dashboard/support/new?order=${esim.orderItem.order.id}`} className="underline">Open a support ticket</Link>.</p>
      </section>
    </div>
  );
}
