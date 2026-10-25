import { NewTicketForm } from "@/components/dashboard/support-forms";
import { requireUser } from "@/server/auth/session";
import { listOrdersForSupport } from "@/server/customer/queries";
import { PageHeader } from "@/components/common/page-header";

export const metadata = { title: "New support ticket" };

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/dashboard/support/new");
  const sp = await searchParams;
  const orders = await listOrdersForSupport(user.id);
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader eyebrow="Help & support" title="Open a support ticket" description="Tell us what happened. Pick the order if it is about a purchase." />
      <div className="surface p-6">
        <NewTicketForm
          orders={orders.map((o) => ({ id: o.id, label: `${o.number} — ${o.items[0]?.description ?? "Order"}` }))}
          defaultOrderId={typeof sp.order === "string" ? sp.order : undefined}
        />
      </div>
    </div>
  );
}
