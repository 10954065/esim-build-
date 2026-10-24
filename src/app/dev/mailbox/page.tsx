import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dev mailbox", robots: { index: false, follow: false } };

/**
 * Development/test mailbox for the "log" email provider. Returns 404 in staging and
 * production, and whenever a real email provider is configured.
 */
export default async function DevMailboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const env = getEnv();
  if (!["development", "test"].includes(env.APP_ENV) || env.EMAIL_PROVIDER !== "log") notFound();
  const sp = await searchParams;
  const to = typeof sp.to === "string" ? sp.to : undefined;
  const emails = await db.emailDelivery.findMany({
    where: to ? { toAddress: to } : {},
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Development mailbox</h1>
      <p className="text-sm text-muted-foreground">Emails captured by the log provider. Not available in production.</p>
      {emails.map((e) => (
        <article key={e.id} className="rounded-xl border bg-card" data-testid="dev-email" data-to={e.toAddress} data-template={e.template}>
          <header className="border-b px-4 py-2 text-sm">
            <strong>{e.subject}</strong> → {e.toAddress} · {e.template} · {e.createdAt.toISOString()}
          </header>
          {e.devPreview && <iframe title={e.subject} srcDoc={e.devPreview} sandbox="" className="h-96 w-full" />}
        </article>
      ))}
    </main>
  );
}
