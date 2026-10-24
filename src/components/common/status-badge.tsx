import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive/10 text-destructive",
};

const LABELS: Record<string, [string, Tone]> = {
  // Orders
  CREATED: ["Created", "neutral"],
  AWAITING_PAYMENT: ["Awaiting payment", "warning"],
  PAID: ["Paid", "info"],
  FULFILLING: ["Processing", "info"],
  FULFILLED: ["Completed", "success"],
  NEEDS_REVIEW: ["Under review", "warning"],
  FAILED: ["Failed", "danger"],
  REFUND_PENDING: ["Refund pending", "warning"],
  PARTIALLY_REFUNDED: ["Partially refunded", "neutral"],
  REFUNDED: ["Refunded", "neutral"],
  CANCELLED: ["Cancelled", "neutral"],
  // Payments
  INITIALIZED: ["Started", "neutral"],
  PENDING: ["Pending", "warning"],
  SUCCEEDED: ["Succeeded", "success"],
  ABANDONED: ["Abandoned", "neutral"],
  // Refunds
  REQUESTED: ["Requested", "neutral"],
  COMPLETED: ["Completed", "success"],
  REJECTED: ["Rejected", "danger"],
  // eSIM
  PREPARING: ["Preparing", "info"],
  READY: ["Ready to install", "success"],
  ACTIVE: ["Active", "success"],
  EXPIRED: ["Expired", "neutral"],
  // Verification
  WAITING: ["Waiting for SMS", "info"],
  RECEIVED: ["SMS received", "success"],
  // Tickets
  OPEN: ["Open", "info"],
  AWAITING_CUSTOMER: ["Awaiting your reply", "warning"],
  AWAITING_STAFF: ["Awaiting support", "info"],
  RESOLVED: ["Resolved", "success"],
  CLOSED: ["Closed", "neutral"],
};

export function statusLabel(status: string): string {
  return LABELS[status]?.[0] ?? status.replace(/_/g, " ").toLowerCase();
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const [label, tone] = LABELS[status] ?? [statusLabel(status), "neutral" as Tone];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone], className)}>
      {label}
    </span>
  );
}

export function DemoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning">
      Demo
    </span>
  );
}
