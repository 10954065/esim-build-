import { ChevronRight, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, maskPhone } from "@/lib/format";
import { flagEmoji } from "@/lib/slug";
import { requireUser } from "@/server/auth/session";
import { listVerifications } from "@/server/customer/queries";

export const metadata = { title: "Verification numbers" };

export default async function VerificationListPage() {
  const user = await requireUser("/dashboard/verification");
  const items = await listVerifications(user.id);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Verification numbers</h1>
      {items.length === 0 ? (
        <EmptyState icon={MessageSquareText} title="No verification numbers yet" description="Numbers you buy for SMS verification and their messages appear here." action={<Button asChild size="sm"><Link href="/verification">Get a number</Link></Button>} />
      ) : (
        <ul className="grid gap-3">
          {items.map((v) => (
            <li key={v.id}>
              <Link href={`/dashboard/verification/${v.id}`} className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:border-foreground/20">
                <span className="text-2xl" aria-hidden>{flagEmoji(v.countryCode)}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">{v.serviceName} <DemoBadge show={v.isSandbox} /></p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{maskPhone(v.phoneNumber)}</span> · {v._count.messages} message{v._count.messages === 1 ? "" : "s"} · {formatDateTime(v.createdAt)}
                  </p>
                </div>
                <StatusBadge status={v.status} />
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
