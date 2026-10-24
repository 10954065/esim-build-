import { BookOpen, CreditCard, MessageSquareText, PhoneCall, Smartphone, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/common/page-header";

export const metadata: Metadata = { title: "Help centre", description: "Guides for travel eSIMs, verification numbers, rentals, payments and refunds.", alternates: { canonical: "/help" } };

const TOPICS = [
  {
    icon: Smartphone,
    title: "Data-only eSIM vs. a phone number",
    body: "Travel eSIMs give you mobile data but no ordinary phone number. They cannot receive SMS codes. Only plans that explicitly list a phone number, SMS or voice include those features.",
    links: [{ href: "/device-compatibility", label: "Check device compatibility" }, { href: "/esims", label: "Browse eSIMs" }],
  },
  {
    icon: MessageSquareText,
    title: "Temporary verification numbers",
    body: "A one-time number for receiving a code from one service within a time limit set by the supplier. Some services reject virtual numbers, so delivery is not guaranteed.",
    links: [{ href: "/verification", label: "Choose a country" }, { href: "/acceptable-use", label: "Acceptable use" }],
  },
  {
    icon: PhoneCall,
    title: "Long-term rentals",
    body: "Keep a number for days or months to receive SMS over time. Rentals are SMS-only, never auto-renew, and we remind you before they expire.",
    links: [{ href: "/numbers/rentals", label: "See rental terms" }],
  },
  {
    icon: CreditCard,
    title: "Payments and refunds",
    body: "You pay on the payment provider's secure page. Orders are delivered only after our server verifies the payment. Refunds return to your original payment method once the provider confirms them.",
    links: [{ href: "/refund-policy", label: "Refund policy" }],
  },
  {
    icon: UserRound,
    title: "Your account",
    body: "Manage your profile, password, two-factor authentication and active sessions from the dashboard. You can request account deletion from your profile.",
    links: [{ href: "/dashboard/security", label: "Security settings" }, { href: "/privacy", label: "Privacy policy" }],
  },
  {
    icon: BookOpen,
    title: "Still stuck?",
    body: "Open a ticket from your dashboard. Linking the order helps us resolve it faster.",
    links: [{ href: "/dashboard/support/new", label: "Open a ticket" }, { href: "/faq", label: "Read the FAQ" }],
  },
];

export default function HelpPage() {
  return (
    <Container className="py-12">
      <PageHeader eyebrow="Help centre" title="How can we help?" description="Short guides to the products we sell and how orders, payments and refunds work." />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {TOPICS.map((t) => (
          <section key={t.title} className="rounded-2xl border bg-card p-6">
            <t.icon className="size-5 text-brand" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold">{t.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {t.links.map((l) => (
                <Link key={l.href} href={l.href} className="font-medium underline underline-offset-2">{l.label}</Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Container>
  );
}
