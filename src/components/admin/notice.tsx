/** Result banner for admin actions (passed back via ?notice= / ?error= after redirect). */
export function ActionNotice({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const notice = typeof sp.notice === "string" ? sp.notice : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  if (!notice && !error) return null;
  return (
    <p role={error ? "alert" : "status"} className={error ? "mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" : "mb-4 rounded-lg bg-success-soft px-3 py-2 text-sm"}>
      {error ?? notice}
    </p>
  );
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function sp1(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" && v ? v.slice(0, 120) : undefined;
}
