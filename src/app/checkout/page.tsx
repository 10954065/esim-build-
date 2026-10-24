import { AlertTriangle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { DemoBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { requireUser } from "@/server/auth/session";
import { isUuid } from "@/server/customer/queries";
import { quoteProduct } from "@/server/orders/checkout";
import { dec } from "@/server/pricing/money";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const productId = typeof sp.product === "string" ? sp.product : "";
  await requireUser(`/checkout?product=${encodeURIComponent(productId)}`);
  const days = typeof sp.days === "string" ? Number.parseInt(sp.days, 10) || 1 : undefined;
  const promo = typeof sp.promo === "string" ? sp.promo.slice(0, 40) : undefined;

  const result = isUuid(productId) ? await quoteProduct({ productId, days, promoCode: promo }) : { ok: false as const, reason: "No product selected." };
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border bg-card p-8 text-center">
        <AlertTriangle className="mx-auto size-8 text-warning" aria-hidden />
        <h1 className="text-xl font-semibold">This item is not available right now</h1>
        <p className="text-sm text-muted-foreground">{result.reason}</p>
        <Button asChild variant="outline"><Link href="/esims">Back to the store</Link></Button>
      </div>
    );
  }
  const q = result.quote;
  const money = (v: string) => formatMoney(v, q.currency);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Checkout</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">{q.title} <DemoBadge show={q.isSandbox} /></h1>
          <p className="text-sm text-muted-foreground">{q.subtitle}</p>
        </div>

        {q.perDay && (
          <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
            <input type="hidden" name="product" value={q.productId} />
            {promo && <input type="hidden" name="promo" value={promo} />}
            <label className="space-y-1 text-sm">
              <span className="block font-medium">Number of days</span>
              <input type="number" name="days" min={1} max={365} defaultValue={q.quantity} className="h-9 w-28 rounded-md border bg-background px-3" />
            </label>
            <Button type="submit" variant="outline" size="sm">Update</Button>
          </form>
        )}

        <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
          <input type="hidden" name="product" value={q.productId} />
          {q.perDay && <input type="hidden" name="days" value={q.quantity} />}
          <label className="space-y-1 text-sm">
            <span className="block font-medium">Promotion code</span>
            <input name="promo" defaultValue={promo} maxLength={40} className="h-9 w-48 rounded-md border bg-background px-3 uppercase" />
          </label>
          <Button type="submit" variant="outline" size="sm">Apply</Button>
          {q.promoMessage && <p role="alert" className="w-full text-sm text-destructive">{q.promoMessage}</p>}
          {q.promotionId && <p className="w-full text-sm text-success">Promotion applied.</p>}
        </form>

        {q.productType === "ESIM" && (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            This is a <strong className="text-foreground">data-only</strong> eSIM: it does not include a phone number and cannot receive SMS
            codes. Make sure your phone supports eSIM and is unlocked — <Link href="/device-compatibility" className="underline">check compatibility</Link>.
          </p>
        )}
        {q.productType === "VERIFICATION" && (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            You receive one temporary number for a limited time set by the supplier. Delivery of a code is not guaranteed; if no SMS arrives and
            the supplier refunds the activation, we refund you automatically.
          </p>
        )}
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{q.perDay ? `${money(q.listUnitPrice)} × ${q.quantity} days` : "Price"}</dt>
              <dd className="tabular-nums">{money(dec(q.listUnitPrice).times(q.quantity).toString())}</dd>
            </div>
            {dec(q.discountTotal).gt(0) && (
              <div className="flex justify-between text-success">
                <dt>Discount</dt>
                <dd className="tabular-nums">−{money(q.discountTotal)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t pt-3 text-base font-semibold">
              <dt>Total to pay</dt>
              <dd className="tabular-nums">{money(q.total)}</dd>
            </div>
            <p className="text-xs text-muted-foreground">Charged in {q.currency}. The price was just confirmed with our supplier and will not change after you continue.</p>
          </dl>
          <CheckoutForm productId={q.productId} days={q.perDay ? q.quantity : undefined} promoCode={q.promotionId ? promo : undefined} payLabel={`Pay ${money(q.total)}`} />
          <div className="flex gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            Your order is delivered only after the payment is verified on our server.
          </div>
        </div>
      </aside>
    </div>
  );
}
