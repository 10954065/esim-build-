import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { Logo } from "./logo";
import { FOOTER_NAV, LEGAL_NAV } from "./nav-links";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/10 bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo className="[&>span:first-child]:bg-primary [&>span:first-child>span]:ring-ink [&>span:last-child]:text-white" />
          <p className="max-w-xs text-sm leading-relaxed text-white/65">
            Travel eSIM data plans, temporary numbers for SMS verification and longer number rentals, delivered to a private
            dashboard after payment is verified on our server.
          </p>
          <p className="text-sm text-white/65">
            Support: <span className="font-medium text-white">{siteConfig.supportEmail}</span>
          </p>
        </div>
        {FOOTER_NAV.map((group) => (
          <div key={group.title}>
            <h2 className="font-sans text-xs font-semibold tracking-[0.12em] text-white/55 uppercase">{group.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/80 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-white/60 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. Availability depends on supplier inventory and each network&apos;s rules.
            Verification numbers must not be used to bypass security or identity checks.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1">
            {LEGAL_NAV.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
