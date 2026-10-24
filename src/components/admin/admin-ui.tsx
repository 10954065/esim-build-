import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small, consistent building blocks for staff pages (server components). */

export function AdminHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Filters({ action, q, status, statuses, extra }: { action: string; q?: string; status?: string; statuses?: string[]; extra?: ReactNode }) {
  return (
    <form method="get" action={action} className="mb-4 flex flex-wrap items-center gap-2">
      <input name="q" defaultValue={q} placeholder="Search…" maxLength={100} className="h-9 w-64 rounded-md border bg-background px-3 text-sm" />
      {statuses && (
        <select name="status" defaultValue={status ?? ""} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}
      {extra}
      <button type="submit" className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Filter</button>
    </form>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {empty ? (
            <tr>
              <td colSpan={head.length} className="px-3 py-10 text-center text-muted-foreground">Nothing to show.</td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, mono }: { children: ReactNode; className?: string; mono?: boolean }) {
  return <td className={cn("whitespace-nowrap px-3 py-2.5", mono && "font-mono text-xs", className)}>{children}</td>;
}

export function Pager({ page, totalPages, base, params }: { page: number; totalPages: number; base: string; params?: Record<string, string | undefined> }) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${base}?${sp}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? <Link href={href(page - 1)} className="underline">Previous</Link> : <span />}
      <span className="text-muted-foreground">Page {page} of {totalPages}</span>
      {page < totalPages ? <Link href={href(page + 1)} className="underline">Next</Link> : <span />}
    </nav>
  );
}

export function Stat({ label, value, href, tone = "neutral" }: { label: string; value: ReactNode; href?: string; tone?: "neutral" | "warning" | "danger" }) {
  const body = (
    <>
      <dd className={cn("text-2xl font-semibold tabular-nums", tone === "warning" && "text-warning", tone === "danger" && "text-destructive")}>{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-xl border bg-card p-4 hover:border-foreground/20">{body}</Link>
  ) : (
    <div className="rounded-xl border bg-card p-4">{body}</div>
  );
}

export function Panel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Inline server-action form requiring a written reason (recorded in the audit log). */
export function ReasonForm({ action, hidden, label, destructive, placeholder }: { action: (fd: FormData) => Promise<void>; hidden: Record<string, string>; label: string; destructive?: boolean; placeholder?: string }) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input name="reason" required minLength={5} maxLength={300} placeholder={placeholder ?? "Reason (required, audited)"} className="h-8 w-64 rounded-md border bg-background px-2 text-sm" />
      <button type="submit" className={cn("h-8 rounded-md px-3 text-sm font-medium", destructive ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary text-primary-foreground")}>
        {label}
      </button>
    </form>
  );
}
