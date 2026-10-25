import { Package } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { OrdersTable } from "@/components/dashboard/orders-table";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth/session";
import { listOrders } from "@/server/customer/queries";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/dashboard/orders");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const data = await listOrders(user.id, page);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Orders & receipts</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Orders</h1>
        <p className="mt-1 text-muted-foreground">Every purchase, its payment and delivery status.</p>
      </div>
      {data.items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="When you buy an eSIM or a number, it appears here."
          action={
            <Button asChild size="sm">
              <Link href="/esims">Browse eSIMs</Link>
            </Button>
          }
        />
      ) : (
        <section className="surface overflow-hidden">
          <OrdersTable orders={data.items} />
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              Showing {data.items.length} of {data.total} order{data.total === 1 ? "" : "s"}
            </span>
            {data.pages > 1 && (
              <nav aria-label="Pagination" className="flex items-center gap-1">
                {page > 1 && (
                  <Link href={`?page=${page - 1}`} className="rounded-lg px-3 py-1.5 hover:bg-muted">
                    Previous
                  </Link>
                )}
                <span className="px-2 font-semibold">
                  Page {page} of {data.pages}
                </span>
                {page < data.pages && (
                  <Link href={`?page=${page + 1}`} className="rounded-lg px-3 py-1.5 hover:bg-muted">
                    Next
                  </Link>
                )}
              </nav>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
