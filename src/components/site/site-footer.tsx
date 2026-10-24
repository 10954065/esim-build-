import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { Logo } from "./logo";
import { FOOTER_NAV } from "./nav-links";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Travel eSIM data plans and temporary phone numbers for SMS verification, delivered to a private dashboard after
            server-verified payment.
          </p>
          <p className="text-sm text-muted-foreground">
            Support: <span className="font-medium text-foreground">{siteConfig.supportEmail}</span>
          </p>
        </div>
        {FOOTER_NAV.map((group) => (
          <div key={group.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-foreground/80 hover:text-foreground hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. Service availability depends on supplier inventory and the rules of each
            destination network and online service.
          </p>
          <p>Verification numbers must not be used to bypass security or identity checks.</p>
        </div>
      </div>
    </footer>
  );
}
