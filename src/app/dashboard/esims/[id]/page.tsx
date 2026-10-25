import { AlertTriangle, Calendar, Gauge, Hash, Loader2, Signal, Wifi } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { Flag } from "@/components/common/flag";
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
  const destination = product.destination;
  const lpa = parseLpa(esim.activationCode);
  const demo = esim.isSandbox || isDemoActivation(esim.activationCode);
  const used = esim.usedVolumeBytes;
  const total = esim.totalVolumeBytes;
  const usagePct = used !== null && total ? Math.min(100, Number((used * BigInt(1000)) / total) / 10) : null;

  const specs = [
    { label: "Data", value: product.dataLabel ?? formatBytes(total), icon: Gauge },
    { label: "Validity", value: formatValidity(product.validityDays), icon: Calendar },
    { label: "Network", value: product.speed ?? "—", icon: Signal },
    { label: "APN", value: esim.apn ?? "Automatic", icon: Wifi, mono: Boolean(esim.apn) },
  ];

  return (
    <div className="space-y-6">
      <AutoRefresh active={esim.status === "PREPARING"} seconds={8} />
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "My eSIMs", href: "/dashboard/esims" }, { label: esim.orderItem.description }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Flag code={destination?.country?.code} kind={destination?.kind ?? "COUNTRY"} size="lg" className="mt-1" />
          <div>
            <p className="eyebrow">eSIM installation</p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {esim.orderItem.description} <DemoBadge show={demo} />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {destination?.name ?? "Travel eSIM"} · Order{" "}
              <Link href={`/dashboard/orders/${esim.orderItem.order.id}`} className="font-mono text-foreground underline-offset-2 hover:text-primary hover:underline">
                {esim.orderItem.order.number}
              </Link>
            </p>
          </div>
        </div>
        <StatusBadge status={esim.status} className="text-sm" />
      </div>

      {demo && (
        <div role="note" className="flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p>
            This is a <strong>demo eSIM</strong> from the sandbox supplier. Its activation code points to a non-existent server and cannot be installed.
          </p>
        </div>
      )}

      {esim.status === "PREPARING" || !esim.activationCode ? (
        <div className="surface flex items-center gap-3 p-6 text-sm">
          <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden />
          <p>Your eSIM is being prepared by our supplier. This page updates automatically when the activation details are ready.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          <section aria-labelledby="qr-heading" className="surface h-fit p-6 text-center lg:sticky lg:top-20">
            <h2 id="qr-heading" className="font-semibold">
              Scan to install
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Open this page on another screen, then scan it with the phone you are travelling with.</p>
            {esim.qrDataUrl && (
              <div className="mx-auto mt-5 w-fit rounded-2xl border bg-white p-3 shadow-card">
                <Image src={esim.qrDataUrl} alt="eSIM installation QR code" width={240} height={240} unoptimized className="rounded-lg" />
              </div>
            )}
            <dl className="mt-5 border-t pt-4 text-left text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Hash className="size-3.5" aria-hidden /> ICCID
                </dt>
                <dd className="font-mono text-xs break-all">{esim.iccid ?? "—"}</dd>
              </div>
            </dl>
            <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
              Keep this code private. Anyone who scans it may be able to install your eSIM, and most eSIMs can only be installed once.
            </p>
          </section>

          <section aria-labelledby="install-heading" className="surface p-6">
            <h2 id="install-heading" className="text-lg font-semibold">
              How to install
            </h2>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">Install before you travel while you are on Wi-Fi, then switch it on when you land.</p>
            <EsimInstallPanel
              smdpAddress={lpa?.smdpAddress ?? null}
              matchingId={lpa?.matchingId ?? null}
              activationCode={esim.activationCode}
              appleLink={!demo ? appleInstallLink(esim.activationCode) : null}
            />
          </section>
        </div>
      )}

      <section aria-labelledby="plan-heading" className="surface p-6">
        <h2 id="plan-heading" className="font-semibold">
          Plan details
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {specs.map((s) => (
            <div key={s.label} className="rounded-xl border bg-muted/50 p-4">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <s.icon className="size-3.5 text-primary" aria-hidden /> {s.label}
              </dt>
              <dd className={s.mono ? "mt-1 font-mono text-sm break-all" : "mt-1 font-semibold"}>{s.value}</dd>
            </div>
          ))}
        </dl>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3 border-b py-2">
            <dt className="text-muted-foreground">Activated</dt>
            <dd>{formatDateTime(esim.activatedAt)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b py-2">
            <dt className="text-muted-foreground">Expires</dt>
            <dd>{formatDateTime(esim.expiresAt)}</dd>
          </div>
        </dl>
        {usagePct !== null && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Data used (as reported by supplier)</span>
              <span className="tabular-nums">
                {formatBytes(used)} of {formatBytes(total)}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Data used" aria-valuenow={usagePct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${usagePct}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Last updated {formatDateTime(esim.lastRefreshedAt ?? esim.updatedAt)}</p>
          </div>
        )}
        {product.fupPolicy && <p className="mt-4 text-xs text-muted-foreground">Fair use after allowance: {product.fupPolicy}</p>}
        <p className="mt-4 text-xs text-muted-foreground">
          Top-ups are not available for this plan. Need help?{" "}
          <Link href={`/dashboard/support/new?order=${esim.orderItem.order.id}`} className="font-medium text-primary hover:underline">
            Open a support ticket
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
