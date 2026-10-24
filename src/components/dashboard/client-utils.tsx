"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label={`${label} to clipboard`}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : label}
    </Button>
  );
}

/**
 * Re-render the server component every `seconds` while `active` and the tab is visible.
 * Used for pages waiting on supplier events (SMS arrival, eSIM preparation).
 */
export function AutoRefresh({ active, seconds = 8 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [active, seconds, router]);
  return null;
}

export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return <span>expired</span>;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const h = Math.floor(m / 60);
  return <span className="tabular-nums">{h > 0 ? `${h}h ${m % 60}m` : `${m}:${String(s).padStart(2, "0")}`}</span>;
}
