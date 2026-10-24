import { createExchangeRateAction, createPricingRuleAction, createPromotionAction, setPricingRuleActiveAction, setPromotionActiveAction } from "@/app/admin/actions";
import { AdminHeader, Panel, Table, Td } from "@/components/admin/admin-ui";
import { ActionNotice, type SearchParams } from "@/components/admin/notice";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";

export const metadata = { title: "Pricing" };

const input = "h-8 rounded-md border bg-background px-2 text-sm";

export default async function AdminPricing({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireStaff("pricing.read");
  const sp = await searchParams;
  const env = getEnv();
  const manage = can(staff.role, "pricing.manage");
  const [rules, rates, promos, countries, services, destinations] = await Promise.all([
    db.pricingRule.findMany({ orderBy: [{ isActive: "desc" }, { priority: "desc" }, { createdAt: "desc" }], include: { country: true, service: true, destination: true, product: { select: { name: true } } } }),
    db.exchangeRate.findMany({ orderBy: { effectiveAt: "desc" }, take: 20 }),
    db.promotion.findMany({ orderBy: { createdAt: "desc" } }),
    db.country.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.service.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.esimDestination.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const back = <input type="hidden" name="back" value="/admin/pricing" />;
  return (
    <>
      <AdminHeader
        title="Pricing"
        description={`Customers pay in ${env.PAYMENT_CURRENCY}; supplier prices are in ${env.SUPPLIER_PRICE_CURRENCY}. The most specific active rule wins: product › service+country › service › destination › country › product type › global.`}
      />
      <ActionNotice sp={sp} />
      <div className="space-y-6">
        <Panel title="Margin rules">
          <Table head={["Name", "Scope", "Markup %", "Fixed", "Min profit", "Priority", "Status", ""]} empty={rules.length === 0}>
            {rules.map((r) => (
              <tr key={r.id} className={r.isActive ? "" : "opacity-50"}>
                <Td>{r.name}</Td>
                <Td className="text-xs">{[r.productType, r.country?.name, r.destination?.name, r.service?.name, r.product?.name].filter(Boolean).join(" · ") || "Global"}</Td>
                <Td>{r.markupPercent.toString()}</Td>
                <Td>{r.markupFixed.toString()} {r.currency}</Td>
                <Td>{r.minProfit?.toString() ?? "—"}</Td>
                <Td>{r.priority}</Td>
                <Td>{r.isActive ? "Active" : "Inactive"}</Td>
                <Td>
                  {manage && (
                    <form action={setPricingRuleActiveAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="value" value={r.isActive ? "false" : "true"} />
                      {back}
                      <button className="h-7 rounded border px-2 text-xs">{r.isActive ? "Deactivate" : "Activate"}</button>
                    </form>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          {manage && (
            <form action={createPricingRuleAction} className="mt-4 grid gap-2 rounded-lg border border-dashed p-3 md:grid-cols-4">
              {back}
              <input name="name" required placeholder="Rule name" className={input} />
              <select name="productType" className={input} defaultValue="">
                <option value="">Any product type</option>
                <option value="ESIM">eSIM</option>
                <option value="VERIFICATION">Verification</option>
                <option value="RENTAL">Rental</option>
              </select>
              <select name="countryId" className={input} defaultValue=""><option value="">Any country</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select name="destinationId" className={input} defaultValue=""><option value="">Any eSIM destination</option>{destinations.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select name="serviceId" className={input} defaultValue=""><option value="">Any service</option>{services.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input name="markupPercent" placeholder="Markup % (e.g. 25)" className={input} />
              <input name="markupFixed" placeholder={`Fixed markup (${env.PAYMENT_CURRENCY})`} className={input} />
              <input name="minProfit" placeholder={`Min profit (${env.PAYMENT_CURRENCY})`} className={input} />
              <input name="priority" placeholder="Priority (0)" className={input} />
              <input type="hidden" name="currency" value={env.PAYMENT_CURRENCY} />
              <button className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Add rule</button>
            </form>
          )}
        </Panel>

        <Panel title="Exchange rates">
          <p className="mb-3 text-sm text-muted-foreground">
            Only needed when the supplier currency differs from the checkout currency. Rates are never fetched or hardcoded automatically — enter the rate you have verified and its source.
          </p>
          <Table head={["Pair", "Rate", "Source", "Effective"]} empty={rates.length === 0}>
            {rates.map((r) => (
              <tr key={r.id}>
                <Td mono>{r.baseCurrency}→{r.quoteCurrency}</Td>
                <Td>{r.rate.toString()}</Td>
                <Td>{r.source}</Td>
                <Td className="text-muted-foreground">{formatDateTime(r.effectiveAt)}</Td>
              </tr>
            ))}
          </Table>
          {manage && (
            <form action={createExchangeRateAction} className="mt-4 flex flex-wrap gap-2">
              {back}
              <input name="base" defaultValue={env.SUPPLIER_PRICE_CURRENCY} maxLength={3} className={`${input} w-20`} />
              <input name="quote" defaultValue={env.PAYMENT_CURRENCY} maxLength={3} className={`${input} w-20`} />
              <input name="rate" required placeholder="Rate" className={`${input} w-32`} />
              <input name="source" required placeholder="Source (e.g. bank rate 2026-10-24)" className={`${input} w-72`} />
              <button className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Record rate</button>
            </form>
          )}
        </Panel>

        <Panel title="Promotions">
          <Table head={["Code", "Discount", "Redemptions", "Ends", "Status", ""]} empty={promos.length === 0}>
            {promos.map((p) => (
              <tr key={p.id}>
                <Td mono>{p.code}</Td>
                <Td>{p.percentOff ? `${p.percentOff}%` : `${p.amountOff} ${p.currency}`}</Td>
                <Td>{p.redemptionCount}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}</Td>
                <Td>{formatDateTime(p.endsAt)}</Td>
                <Td>{p.isActive ? "Active" : "Inactive"}</Td>
                <Td>
                  {manage && (
                    <form action={setPromotionActiveAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="value" value={p.isActive ? "false" : "true"} />
                      {back}
                      <button className="h-7 rounded border px-2 text-xs">{p.isActive ? "Deactivate" : "Activate"}</button>
                    </form>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          {manage && (
            <form action={createPromotionAction} className="mt-4 flex flex-wrap gap-2">
              {back}
              <input name="code" required placeholder="CODE" className={`${input} w-32 uppercase`} />
              <input name="percentOff" placeholder="% off" className={`${input} w-20`} />
              <input name="amountOff" placeholder="or amount off" className={`${input} w-28`} />
              <input type="hidden" name="currency" value={env.PAYMENT_CURRENCY} />
              <input name="maxRedemptions" placeholder="Max uses" className={`${input} w-24`} />
              <input name="endsAt" type="date" className={input} />
              <input name="description" placeholder="Internal description" className={`${input} w-56`} />
              <button className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Create promotion</button>
            </form>
          )}
        </Panel>
      </div>
    </>
  );
}
