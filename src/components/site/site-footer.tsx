import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { Logo } from "./logo";
import { FOOTER_NAV, LEGAL_NAV } from "./nav-links";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Travel eSIM data plans, temporary numbers for SMS verification and longer number rentals — delivered to a private
            dashboard after server-verified payment.
          </p>
          <p className="text-sm text-muted-foreground">
            Support: <span className="font-medium text-foreground">{siteConfig.supportEmail}</span>
          </p>
        </div>
        {FOOTER_NAV.map((group) => (
          <div key={group.title}>
            <h2 className="text-xs font-semibold tracking-[0.08em] text-foreground uppercase">{group.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:px-8 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. Availability depends on supplier inventory and each network&apos;s rules.
            Verification numbers must not be used to bypass security or identity checks.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1">
            {LEGAL_NAV.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
