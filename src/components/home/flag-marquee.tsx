import Link from "next/link";
import { Flag } from "@/components/common/flag";

export interface MarqueeItem {
  href: string;
  name: string;
  code: string;
}

/**
 * Slow, endless strip of the countries we actually sell. The list is rendered twice for a seamless loop;
 * the copy is hidden from assistive tech and keyboard focus. Hover pauses it; reduced motion stops it.
 */
export function FlagMarquee({ items, label }: { items: MarqueeItem[]; label: string }) {
  if (items.length === 0) return null;
  const strip = (copy: boolean) => (
    <ul aria-hidden={copy || undefined} className="flex shrink-0 items-center gap-3 pr-3">
      {items.map((it) => (
        <li key={`${copy ? "copy" : "main"}-${it.code}`}>
          <Link
            href={it.href}
            tabIndex={copy ? -1 : undefined}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pr-3.5 pl-1.5 text-sm font-medium whitespace-nowrap text-white/85 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <Flag code={it.code} size="sm" className="size-5 rounded-full object-cover" />
            {it.name}
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <nav aria-label={label} className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
        {strip(false)}
        {strip(true)}
      </div>
    </nav>
  );
}
