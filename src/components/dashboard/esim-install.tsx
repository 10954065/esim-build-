"use client";

import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "./client-utils";

interface Props {
  smdpAddress: string | null;
  matchingId: string | null;
  activationCode: string;
  appleLink: string | null;
}

const IPHONE_STEPS: ReactNode[] = [
  "Connect to Wi-Fi.",
  <>
    Open <strong className="text-foreground">Settings → Mobile Service</strong> (or Cellular) → <strong className="text-foreground">Add eSIM</strong>.
  </>,
  <>
    Choose <strong className="text-foreground">Use QR Code</strong> and scan the code shown on this page from another screen, or tap <em>Enter Details Manually</em>.
  </>,
  "Label the plan (e.g. “Travel”), keep your main line for calls/SMS, and select the travel eSIM for mobile data.",
  <>
    At your destination, turn on <strong className="text-foreground">Data Roaming</strong> for the travel eSIM only.
  </>,
];

const ANDROID_STEPS: ReactNode[] = [
  "Connect to Wi-Fi.",
  <>
    Open <strong className="text-foreground">Settings → Network &amp; internet → SIMs</strong> (Samsung: <em>Connections → SIM manager</em>).
  </>,
  <>
    Tap <strong className="text-foreground">Add eSIM</strong> / <strong className="text-foreground">Download a SIM instead</strong> and scan the QR code, or enter the
    activation code manually.
  </>,
  "Set the travel eSIM as your mobile data SIM.",
  <>
    At your destination, enable <strong className="text-foreground">Roaming</strong> for the travel eSIM.
  </>,
];

function Steps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm text-muted-foreground">
          <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-primary">
            {i + 1}
          </span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function DetailRow({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2.5">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={small ? "font-mono text-xs break-all" : "font-mono break-all"}>{value}</dd>
      </div>
      <CopyButton value={value} />
    </div>
  );
}

export function EsimInstallPanel({ smdpAddress, matchingId, activationCode, appleLink }: Props) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="space-y-6">
      <Tabs defaultValue="iphone">
        <TabsList>
          <TabsTrigger value="iphone">iPhone</TabsTrigger>
          <TabsTrigger value="android">Android</TabsTrigger>
        </TabsList>
        <TabsContent value="iphone" className="mt-5 space-y-4">
          <Steps steps={IPHONE_STEPS} />
          {appleLink && (
            <Button asChild variant="outline" size="sm">
              <a href={appleLink} rel="noopener noreferrer">
                Install directly on this iPhone (iOS 17.4+)
              </a>
            </Button>
          )}
        </TabsContent>
        <TabsContent value="android" className="mt-5 space-y-4">
          <Steps steps={ANDROID_STEPS} />
          <p className="text-xs text-muted-foreground">Menu names vary by manufacturer and Android version.</p>
        </TabsContent>
      </Tabs>

      <div className="rounded-2xl border bg-muted/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-primary shadow-card">
              <KeyRound className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Manual activation details</p>
              <p className="text-xs text-muted-foreground">Use these if you cannot scan the QR code. Keep them private.</p>
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setRevealed((v) => !v)} aria-expanded={revealed}>
            {revealed ? <EyeOff /> : <Eye />} {revealed ? "Hide" : "Reveal"}
          </Button>
        </div>
        {revealed && (
          <dl className="mt-4 space-y-2 text-sm">
            {smdpAddress && <DetailRow label="SM-DP+ address" value={smdpAddress} />}
            {matchingId && <DetailRow label="Activation code" value={matchingId} />}
            <DetailRow label="Full LPA string" value={activationCode} small />
          </dl>
        )}
      </div>
    </div>
  );
}
