"use client";

import { Loader2, Monitor, ShieldCheck, ShieldOff } from "lucide-react";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/account/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function ChangePasswordForm() {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (form.next.length < 10) return toast.error("Use at least 10 characters.");
        if (form.next !== form.confirm) return toast.error("Passwords do not match.");
        start(async () => {
          const { error } = await authClient.changePassword({ currentPassword: form.current, newPassword: form.next, revokeOtherSessions: true });
          if (error) toast.error(error.status === 429 ? "Too many attempts. Try again later." : "Your current password is incorrect.");
          else {
            toast.success("Password changed. Other sessions were signed out.");
            setForm({ current: "", next: "", confirm: "" });
          }
        });
      }}
    >
      <Field id="current" label="Current password">
        <Input id="current" type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} required />
      </Field>
      <Field id="new" label="New password" hint="At least 10 characters.">
        <Input id="new" type="password" autoComplete="new-password" value={form.next} onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} required />
      </Field>
      <Field id="confirm" label="Confirm new password">
        <Input id="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} required />
      </Field>
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Change password</Button>
    </form>
  );
}

export function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ qr: string; backupCodes: string[] } | null>(null);
  const [code, setCode] = useState("");

  if (setup) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Scan this QR code with an authenticator app, then enter the 6-digit code to finish.</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated locally */}
        <img src={setup.qr} alt="Authenticator setup QR code" width={200} height={200} className="rounded-lg border bg-white p-2" />
        <div>
          <p className="text-sm font-medium">Backup codes</p>
          <p className="text-xs text-muted-foreground">Store these somewhere safe. Each can be used once if you lose your device.</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-5">
            {setup.backupCodes.map((c) => (
              <li key={c} className="rounded bg-muted px-2 py-1">{c}</li>
            ))}
          </ul>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const { error } = await authClient.twoFactor.verifyTotp({ code });
              if (error) return void toast.error("That code is not valid.");
              toast.success("Two-factor authentication is on.");
              setSetup(null);
              router.refresh();
            });
          }}
        >
          <Field id="totp" label="Code">
            <Input id="totp" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className="w-32" autoComplete="one-time-code" />
          </Field>
          <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Verify and enable</Button>
        </form>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          if (enabled) {
            const { error } = await authClient.twoFactor.disable({ password });
            if (error) return void toast.error("Password incorrect.");
            toast.success("Two-factor authentication disabled.");
            setPassword("");
            router.refresh();
            return;
          }
          const { data, error } = await authClient.twoFactor.enable({ password });
          if (error || !data) return void toast.error("Password incorrect.");
          if (!("totpURI" in data)) return void toast.error("Authenticator setup is not available.");
          const qr = await QRCode.toDataURL(data.totpURI, { margin: 1, width: 200 });
          setSetup({ qr, backupCodes: data.backupCodes });
          setPassword("");
        });
      }}
    >
      <p className="flex items-center gap-2 text-sm">
        {enabled ? <ShieldCheck className="size-4 text-success" aria-hidden /> : <ShieldOff className="size-4 text-muted-foreground" aria-hidden />}
        Two-factor authentication is <strong>{enabled ? "on" : "off"}</strong>.
      </p>
      <Field id="2fa-password" label="Confirm with your password">
        <Input id="2fa-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="max-w-xs" />
      </Field>
      <Button type="submit" variant={enabled ? "outline" : "default"} disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} {enabled ? "Turn off two-factor" : "Set up two-factor"}
      </Button>
    </form>
  );
}

interface SessionRow {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date | string;
}

export function SessionsPanel({ currentToken }: { currentToken: string }) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      const { data } = await authClient.listSessions();
      setSessions((data as SessionRow[] | null) ?? []);
    });

  useEffect(load, []);

  if (!sessions) return <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading sessions" />;
  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {sessions.map((s) => {
          const current = s.token === currentToken;
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Monitor className="size-4 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate">{s.userAgent ?? "Unknown device"}</p>
                <p className="text-xs text-muted-foreground">{s.ipAddress ?? "Unknown IP"} · since {new Date(s.createdAt).toLocaleString()}</p>
              </div>
              {current ? (
                <span className="text-xs font-medium text-success">This device</span>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await authClient.revokeSession({ token: s.token });
                      load();
                    })
                  }
                >
                  Sign out
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || sessions.length < 2}
        onClick={() =>
          start(async () => {
            await authClient.revokeOtherSessions();
            toast.success("Signed out of all other devices.");
            load();
          })
        }
      >
        Sign out all other devices
      </Button>
    </div>
  );
}
