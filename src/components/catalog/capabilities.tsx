import { MessageSquareOff, PhoneOff, Signal, Wifi } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface CapabilityProps {
  includesPhoneNumber: boolean;
  includesSms: boolean;
  includesVoice: boolean;
}

/** Truthful capability badges, data-only unless the supplier explicitly confirms more. */
export function CapabilityBadges({ includesPhoneNumber, includesSms, includesVoice }: CapabilityProps) {
  const dataOnly = !includesPhoneNumber && !includesSms && !includesVoice;
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="secondary" className="gap-1">
        <Wifi className="size-3" aria-hidden /> Mobile data
      </Badge>
      {dataOnly ? (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <PhoneOff className="size-3" aria-hidden /> Data only · no phone number
        </Badge>
      ) : (
        <>
          {includesPhoneNumber && <Badge variant="secondary">Includes phone number</Badge>}
          {includesSms && <Badge variant="secondary">SMS</Badge>}
          {includesVoice && <Badge variant="secondary">Voice calls</Badge>}
        </>
      )}
    </div>
  );
}

export function DataOnlyNotice() {
  return (
    <div className="flex gap-3 rounded-2xl border border-primary/15 bg-accent p-5 text-sm">
      <MessageSquareOff className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold text-foreground">These are data only eSIMs</p>
        <p className="text-muted-foreground">
          They give you mobile internet abroad but do not include an ordinary phone number, so they cannot receive SMS
          verification codes. If you need a number for verification, use a{" "}
          <Link href="/verification" className="font-medium text-primary underline underline-offset-2">
            verification number
          </Link>{" "}
          instead.
        </p>
      </div>
    </div>
  );
}

export function SpeedBadge({ speed }: { speed: string | null }) {
  if (!speed) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
      <Signal className="size-3" aria-hidden />
      {speed}
    </span>
  );
}
