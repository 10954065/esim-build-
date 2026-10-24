"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "./client-utils";

interface Props {
  smdpAddress: string | null;
  matchingId: string | null;
  activationCode: string;
  appleLink: string | null;
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
        <TabsContent value="iphone" className="mt-4 space-y-3 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>Connect to Wi-Fi.</li>
            <li>Open <strong className="text-foreground">Settings → Mobile Service</strong> (or Cellular) → <strong className="text-foreground">Add eSIM</strong>.</li>
            <li>Choose <strong className="text-foreground">Use QR Code</strong> and scan the code shown on this page from another screen, or tap <em>Enter Details Manually</em>.</li>
            <li>Label the plan (e.g. “Travel”), keep your main line for calls/SMS, and select the travel eSIM for mobile data.</li>
            <li>At your destination, turn on <strong className="text-foreground">Data Roaming</strong> for the travel eSIM only.</li>
          </ol>
          {appleLink && (
            <Button asChild variant="outline" size="sm">
              <a href={appleLink} rel="noopener noreferrer">Install directly on this iPhone (iOS 17.4+)</a>
            </Button>
          )}
        </TabsContent>
        <TabsContent value="android" className="mt-4 space-y-3 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>Connect to Wi-Fi.</li>
            <li>Open <strong className="text-foreground">Settings → Network &amp; internet → SIMs</strong> (Samsung: <em>Connections → SIM manager</em>).</li>
            <li>Tap <strong className="text-foreground">Add eSIM</strong> / <strong className="text-foreground">Download a SIM instead</strong> and scan the QR code, or enter the activation code manually.</li>
            <li>Set the travel eSIM as your mobile data SIM.</li>
            <li>At your destination, enable <strong className="text-foreground">Roaming</strong> for the travel eSIM.</li>
          </ol>
          <p className="text-xs text-muted-foreground">Menu names vary by manufacturer and Android version.</p>
        </TabsContent>
      </Tabs>

      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Manual activation details</p>
            <p className="text-xs text-muted-foreground">Use these if you cannot scan the QR code. Keep them private.</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRevealed((v) => !v)} aria-expanded={revealed}>
            {revealed ? <EyeOff /> : <Eye />} {revealed ? "Hide" : "Reveal"}
          </Button>
        </div>
        {revealed && (
          <dl className="mt-4 space-y-3 text-sm">
            {smdpAddress && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">SM-DP+ address</dt>
                  <dd className="break-all font-mono">{smdpAddress}</dd>
                </div>
                <CopyButton value={smdpAddress} />
              </div>
            )}
            {matchingId && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Activation code</dt>
                  <dd className="break-all font-mono">{matchingId}</dd>
                </div>
                <CopyButton value={matchingId} />
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Full LPA string</dt>
                <dd className="break-all font-mono text-xs">{activationCode}</dd>
              </div>
              <CopyButton value={activationCode} />
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
