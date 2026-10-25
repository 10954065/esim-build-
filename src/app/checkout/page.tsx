import { AlertTriangle, Info, ShieldCheck, Tag } from "lucide-react";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { Flag } from "@/components/common/flag";
import { DemoBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/currency";
import { requireUser } from "@/server/auth/session";
import { isUuid } from "@/server/customer/queries";
import { quoteProduct } from "@/server/orders/checkout";
import { dec } from "@/server/pricing/money";

const TYPE_LABEL = { ESIM: "Travel eSIM", VERIFICATION: "Verification number", RENTAL: "Number rental" } as const;

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const productId = typeof sp.product === "string" ? sp.product : "";
  await requireUser(`/checkout?product=${encodeURIComponent(productId)}`);
  const days = typeof sp.days === "string" ? Number.parseInt(sp.days, 10) || 1 : undefined;
  const promo = typeof sp.promo === "string" ? sp.promo.slice(0, 40) : undefined;

  const result = isUuid(productId) ? await quoteProduct({ productId, days, promoCode: promo }) : { ok: false as const, reason: "No product selected." };
  if (!result.ok) {
    return (
      <div className="surface mx-auto max-w-lg space-y-4 p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-warning-soft text-warning">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">This item is not available right now</h1>
        <p className="text-sm text-muted-foreground">{result.reason}</p>
        <Button asChild variant="outline">
          <Link href="/esims">Back to the store</Link>
        </Button>
      </div>
    );
  }
  const q = result.quote;
  const money = (v: string) => formatMoney(v, q.currency);

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Checkout</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Review and pay</h1>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
        <section className="space-y-6" aria-label="Your order">
          <div className="surface p-6">
            <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{TYPE_LABEL[q.productType]}</p>
            <div className="mt-3 flex items-start gap-4">
              <Flag code={q.flag.code} kind={q.flag.kind} size="lg" className="mt-0.5" />
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
                  {q.title} <DemoBadge show={q.isSandbox} />
                </h2>
                <p className="text-sm text-muted-foreground">{q.subtitle}</p>
              </div>
            </div>

            {q.productType === "ESIM" && (
              <p className="mt-5 flex gap-3 rounded-xl border border-primary/15 bg-accent p-4 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  This is a <strong className="text-foreground">data-only</strong> eSIM: it does not include a phone number and cannot receive SMS codes.
                  Make sure your phone supports eSIM and is unlocked —{" "}
                  <Link href="/device-compatibility" className="font-medium text-primary underline underline-offset-2">
                    check compatibility
                  </Link>
                  .
                </span>
              </p>
            )}
            {q.productType === "VERIFICATION" && (
              <p className="mt-5 flex gap-3 rounded-xl border border-primary/15 bg-accent p-4 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  You receive one temporary number for a limited time set by the supplier. Delivery of a code is not guaranteed; if no SMS arrives and the
                  supplier refunds the activation, we refund you automatically.
                </span>
              </p>
            )}
          </div>

          {q.perDay && (
            <form method="get" className="surface flex flex-wrap items-end gap-3 p-5">
              <input type="hidden" name="product" value={q.productId} />
              {promo && <input type="hidden" name="promo" value={promo} />}
              <label className="space-y-1.5 text-sm">
                <span className="block font-medium">Number of days</span>
                <Input type="number" name="days" min={1} max={365} defaultValue={q.quantity} className="h-10 w-32" />
              </label>
              <Button type="submit" variant="outline" className="h-10">
                Update
              </Button>
            </form>
          )}

          <form method="get" className="surface p-5">
            <input type="hidden" name="product" value={q.productId} />
            {q.perDay && <input type="hidden" name="days" value={q.quantity} />}
            <label htmlFor="promo" className="flex items-center gap-1.5 text-sm font-medium">
              <Tag className="size-4 text-primary" aria-hidden /> Promotion code
            </label>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <Input id="promo" name="promo" defaultValue={promo} maxLength={40} className="h-10 w-56 uppercase" />
              <Button type="submit" variant="outline" className="h-10">
                Apply
              </Button>
            </div>
            {q.promoMessage && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {q.promoMessage}
              </p>
            )}
            {q.promotionId && <p className="mt-2 text-sm font-medium text-success">Promotion applied.</p>}
          </form>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="surface space-y-5 p-6 shadow-raised">
            <h2 className="font-semibold">Order summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{q.perDay ? `${money(q.listUnitPrice)} × ${q.quantity} days` : "Price"}</dt>
                <dd className="tabular-nums">{money(dec(q.listUnitPrice).times(q.quantity).toString())}</dd>
              </div>
              {dec(q.discountTotal).gt(0) && (
                <div className="flex justify-between gap-3 text-success">
                  <dt>Discount</dt>
                  <dd className="tabular-nums">−{money(q.discountTotal)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3 border-t pt-3">
                <dt className="text-base font-semibold">Total to pay</dt>
                <dd className="text-2xl font-bold tabular-nums">{money(q.total)}</dd>
              </div>
            </dl>
            <p className="-mt-3 text-xs text-muted-foreground">
              Charged in {q.currency}. The price was just confirmed with our supplier and will not change after you continue.
            </p>
            <CheckoutForm productId={q.productId} days={q.perDay ? q.quantity : undefined} promoCode={q.promotionId ? promo : undefined} payLabel={`Pay ${money(q.total)}`} />
            <div className="flex gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
              Your order is delivered only after the payment is verified on our server.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
