import { LifeBuoy, Mail, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Contact", description: "How to reach our support team.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <Container className="py-12">
      <PageHeader eyebrow="Contact" title="Get in touch" description="The fastest way to get help with an order is a support ticket from your dashboard — it is linked to your order history." />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border bg-card p-6">
          <LifeBuoy className="size-5 text-brand" aria-hidden />
          <h2 className="mt-3 font-semibold">Order support</h2>
          <p className="mt-2 text-sm text-muted-foreground">Open a ticket about any order, payment, eSIM installation or missing SMS.</p>
          <Button asChild size="sm" className="mt-4"><Link href="/dashboard/support/new">Open a ticket</Link></Button>
        </section>
        <section className="rounded-2xl border bg-card p-6">
          <Mail className="size-5 text-brand" aria-hidden />
          <h2 className="mt-3 font-semibold">Email</h2>
          <p className="mt-2 text-sm text-muted-foreground">For questions before you buy or if you cannot sign in:</p>
          <p className="mt-3 font-medium">{siteConfig.supportEmail}</p>
        </section>
        <section className="rounded-2xl border bg-card p-6">
          <ShieldAlert className="size-5 text-brand" aria-hidden />
          <h2 className="mt-3 font-semibold">Report abuse</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            To report misuse of one of our numbers, open a ticket with the category “Report abuse” or email us with the number, date and
            details.
          </p>
        </section>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">We reply in the order tickets are received. Response times are not guaranteed.</p>
    </Container>
  );
}
