import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small, consistent building blocks for staff pages (server components). */

export function AdminHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Filters({ action, q, status, statuses, extra }: { action: string; q?: string; status?: string; statuses?: string[]; extra?: ReactNode }) {
  return (
    <form method="get" action={action} className="surface mb-4 flex flex-wrap items-center gap-2 p-3">
      <input name="q" defaultValue={q} placeholder="Search…" aria-label="Search" maxLength={100} type="search" className="h-9 w-full rounded-lg border bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-64" />
      {statuses && (
        <select name="status" aria-label="Filter by status" defaultValue={status ?? ""} className="h-9 rounded-lg border bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}
      {extra}
      <button type="submit" className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Filter</button>
    </form>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div role="region" aria-label="Results" tabIndex={0} className="surface relative overflow-x-auto outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted text-left text-xs tracking-[0.06em] text-muted-foreground uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y [&>tr]:transition-colors [&>tr:hover]:bg-accent/40">
          {empty ? (
            <tr>
              <td colSpan={head.length} className="px-4 py-12 text-center text-muted-foreground">Nothing to show.</td>
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
  return <td className={cn("px-4 py-3 whitespace-nowrap", mono && "font-mono text-xs", className)}>{children}</td>;
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
      {page > 1 ? <Link href={href(page - 1)} className="rounded-lg border bg-card px-3 py-1.5 font-medium shadow-xs hover:bg-muted">Previous</Link> : <span />}
      <span className="text-muted-foreground">Page {page} of {totalPages}</span>
      {page < totalPages ? <Link href={href(page + 1)} className="rounded-lg border bg-card px-3 py-1.5 font-medium shadow-xs hover:bg-muted">Next</Link> : <span />}
    </nav>
  );
}

export function Stat({ label, value, href, tone = "neutral" }: { label: string; value: ReactNode; href?: string; tone?: "neutral" | "warning" | "danger" }) {
  const valueClass = cn("mt-1 text-3xl font-bold tabular-nums", tone === "warning" && "text-warning", tone === "danger" && "text-destructive");
  // dt/dd must be direct children of a div inside the <dl>; a linked card uses a stretched link on the value.
  return (
    <div className={cn("relative p-5", href ? "surface-interactive focus-within:ring-[3px] focus-within:ring-ring/50" : "surface")}>
      <dt className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{label}</dt>
      <dd className={valueClass}>
        {href ? (
          <Link href={href} className="outline-none after:absolute after:inset-0 after:rounded-2xl">
            {value}
            <span className="sr-only">, open {label.toLowerCase()}</span>
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export function Panel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="p-5">{children}</div>
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
      <input name="reason" required minLength={5} maxLength={300} placeholder={placeholder ?? "Reason (required, audited)"} aria-label={placeholder ?? "Reason (required, audited)"} className="h-8 w-64 rounded-lg border bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
      <button type="submit" className={cn("h-8 rounded-lg px-3 text-sm font-semibold", destructive ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary text-primary-foreground")}>
        {label}
      </button>
    </form>
  );
}
