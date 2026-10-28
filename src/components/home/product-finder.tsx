import { ArrowRight, MessageSquareText, PhoneCall, Search, Smartphone } from "lucide-react";
import Link from "next/link";
import { Flag } from "@/components/common/flag";
import { SearchCombobox } from "@/components/common/search-combobox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SuggestOption } from "@/lib/suggest";

export interface FinderCountry {
  href: string;
  name: string;
  code: string | null;
  kind?: "COUNTRY" | "REGION" | "GLOBAL";
}

function QuickPicks({ label, items }: { label: string; items: FinderCountry[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {items.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Flag code={c.code} kind={c.kind} />
          {c.name}
        </Link>
      ))}
    </div>
  );
}

const TAB_TRIGGER =
  "h-9 gap-2 rounded-md px-3.5 text-sm text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card";

/** Segmented product finder from the design: one tab per product line, quick picks with flags. */
export function ProductFinder({
  esimOptions,
  destinations,
  verificationCountries,
  rentalCountries,
}: {
  esimOptions: SuggestOption[];
  destinations: FinderCountry[];
  verificationCountries: FinderCountry[];
  rentalCountries: FinderCountry[];
}) {
  return (
    <div className="surface p-5 shadow-float sm:p-6">
      <Tabs defaultValue="esim" className="gap-5">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-[10px] bg-muted p-1 sm:w-fit">
          <TabsTrigger value="esim" className={TAB_TRIGGER}>
            <Smartphone className="size-4" aria-hidden /> Travel eSIMs
          </TabsTrigger>
          <TabsTrigger value="sms" className={TAB_TRIGGER}>
            <MessageSquareText className="size-4" aria-hidden /> SMS verification
          </TabsTrigger>
          <TabsTrigger value="rental" className={TAB_TRIGGER}>
            <PhoneCall className="size-4" aria-hidden /> Number rentals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="esim" className="space-y-4">
          <form action="/esims" method="get" role="search" className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Destination country or region</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <SearchCombobox
                  id="finder-esim-search"
                  options={esimOptions}
                  listLabel="Destinations"
                  placeholder="Country or region, e.g. Spain"
                  className="h-11 w-full rounded-lg border border-input bg-card pr-3.5 pl-10 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/12 sm:text-sm"
                />
              </span>
            </label>
            <Button type="submit" className="h-11 self-end px-6">
              Find eSIM plans <ArrowRight />
            </Button>
          </form>
          <QuickPicks label="Popular:" items={destinations} />
        </TabsContent>

        <TabsContent value="sms" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A temporary number that receives one SMS code from a supported service within a time limit. Pick the country the
            number should come from.
          </p>
          <QuickPicks label="Countries:" items={verificationCountries} />
          <Button asChild variant="outline" className="h-10">
            <Link href="/verification">
              All verification countries <ArrowRight />
            </Link>
          </Button>
        </TabsContent>

        <TabsContent value="rental" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Keep a number for days or months to receive SMS over a longer period. SMS only, never renewed automatically.
          </p>
          <QuickPicks label="Countries:" items={rentalCountries} />
          <Button asChild variant="outline" className="h-10">
            <Link href="/numbers/rentals">
              Compare rental terms <ArrowRight />
            </Link>
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
