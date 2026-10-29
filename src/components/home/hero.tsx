import { ArrowRight, ArrowUpRight, Search } from "lucide-react";
import Link from "next/link";
import { Price, type PriceValue } from "@/components/catalog/price";
import { SearchCombobox } from "@/components/common/search-combobox";
import type { SuggestOption } from "@/lib/suggest";
import { AmbientVideo } from "./ambient-video";

type Props = {
  destinationCount: number;
  smsCountryCount: number;
  planCount: number;
  cheapest: { name: string; href: string; price: PriceValue | null } | null;
  options: SuggestOption[];
};

/**
 * Inset cinematic frame: footage of someone online above a sea of clouds, copy anchored
 * bottom left over the calm sky, live catalogue proof bottom right. Every number is real.
 */
export function Hero({ destinationCount, smsCountryCount, planCount, cheapest, options }: Props) {
  return (
    <section aria-labelledby="hero-title" className="p-3 sm:p-4 lg:p-5">
      <div className="relative isolate flex min-h-[calc(100svh-8.5rem)] max-h-232 flex-col justify-end rounded-3xl bg-dusk text-white sm:rounded-[2rem]">
        {/* Media layer clips to the frame; the frame itself does not, so search suggestions can overflow it. */}
        <div aria-hidden className="grain absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
          {/* On wide screens the footage is oversized to the right so the figure sits in the right third, clear of the headline. */}
          <div className="absolute inset-y-0 left-0 w-full animate-[settle_1.8s_cubic-bezier(0.16,1,0.3,1)_both] lg:w-[130%]">
            <AmbientVideo src="/media/hero-clouds.mp4" poster="/media/hero-clouds-poster.jpg" className="object-[46%_50%] sm:object-[50%_38%]" />
          </div>
          <div className="absolute inset-0 bg-linear-to-t from-dusk/90 via-dusk/45 to-transparent to-70% sm:via-dusk/30 sm:via-20% sm:to-45%" />
          <div className="absolute inset-0 hidden bg-linear-to-r from-dusk/75 via-dusk/30 via-40% to-transparent to-65% sm:block" />
        </div>

        <div className="flex flex-col gap-10 p-6 pt-28 sm:p-10 lg:flex-row lg:items-end lg:justify-between lg:p-14 xl:p-16">
          <div className="rise max-w-160">
            <p className="glass inline-flex items-center gap-2.5 rounded-full py-1 pr-4 pl-1 text-[13px] text-white/90">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-dusk">
                <span className="size-1.5 animate-pulse-dot rounded-full bg-mint" aria-hidden /> Live
              </span>
              {destinationCount} destinations · {smsCountryCount} SMS countries
            </p>
            <h1 id="hero-title" className="mt-6 font-heading text-[clamp(2.9rem,7.4vw,6.75rem)] leading-[0.95] font-medium tracking-[-0.045em] [text-shadow:0_16px_38px_rgb(0_0_0/0.25)]">
              <span className="block sm:whitespace-nowrap">Touch down</span>
              <span className="block sm:whitespace-nowrap">
                already <em className="font-accent font-normal tracking-[-0.02em] text-white/75">online.</em>
              </span>
            </h1>
            <p className="mt-6 max-w-120 text-[17px] leading-relaxed text-white/80">
              Prepaid eSIM data for {destinationCount} destinations and numbers that receive your SMS codes. The full price in
              cedis before you pay, delivered to your private dashboard.
            </p>
            <form action="/esims" method="get" role="search" className="glass relative z-20 mt-8 flex max-w-xl flex-col gap-1.5 rounded-[1.75rem] p-1.5 min-[560px]:flex-row min-[560px]:rounded-full">
              <label htmlFor="hero-search" className="sr-only">
                Where are you travelling?
              </label>
              <span className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-white/65" aria-hidden />
                <SearchCombobox
                  id="hero-search"
                  options={options}
                  listLabel="Destinations"
                  placeholder="Where are you travelling?"
                  className="h-13 w-full rounded-full bg-transparent pr-4 pl-13 text-base text-white outline-none placeholder:text-white/60 focus-visible:ring-2 focus-visible:ring-white/60"
                />
              </span>
              <button
                type="submit"
                className="group inline-flex h-13 items-center justify-center gap-3 rounded-full bg-white pr-1.5 pl-6 text-[15px] font-semibold text-dusk transition-transform duration-150 hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none active:scale-[0.97]"
              >
                Find plans
                <span className="grid size-10 place-items-center rounded-full bg-dusk text-white transition-transform duration-300 group-hover:translate-x-0.5">
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </button>
            </form>
            <Link href="/verification" className="mt-5 inline-flex items-center gap-1.5 text-sm text-white/80 underline-offset-4 hover:text-white hover:underline">
              Need an SMS code instead? <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </div>

          {cheapest && (
            <Link
              href={cheapest.href}
              className="glass group hidden w-66 shrink-0 animate-[rise_800ms_650ms_cubic-bezier(0.16,1,0.3,1)_both] rounded-3xl p-6 transition-colors hover:bg-white/12 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none lg:block"
            >
              <span className="flex items-center justify-between text-[11px] font-medium tracking-[0.18em] text-white/65 uppercase">
                Plans from
                <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </span>
              <Price value={cheapest.price} className="mt-3 block font-heading text-[2.5rem] leading-none font-medium tracking-[-0.03em] text-white" />
              <span className="mt-2 block text-sm text-white/75">in {cheapest.name}</span>
              <span className="mt-5 block border-t border-white/15 pt-4 text-sm text-white/75">
                <span className="font-semibold text-white tabular-nums">{planCount.toLocaleString("en")}</span> live plans worldwide
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
