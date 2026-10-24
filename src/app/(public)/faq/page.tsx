import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/common/page-header";
import { FAQ, type FaqItem } from "@/content/faq";

export const metadata: Metadata = { title: "Frequently asked questions", description: "Answers about travel eSIMs, verification numbers, rentals, payments and accounts.", alternates: { canonical: "/faq" } };

const SECTIONS: Array<{ key: FaqItem["category"]; title: string }> = [
  { key: "esim", title: "Travel eSIMs" },
  { key: "verification", title: "Verification numbers" },
  { key: "rentals", title: "Rentals" },
  { key: "payments", title: "Payments & refunds" },
  { key: "account", title: "Your account" },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <Container className="py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHeader eyebrow="FAQ" title="Frequently asked questions" />
      <div className="mt-10 max-w-3xl space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.key} aria-labelledby={`faq-${s.key}`}>
            <h2 id={`faq-${s.key}`} className="mb-3 text-lg font-semibold">{s.title}</h2>
            <div className="divide-y rounded-2xl border bg-card">
              {FAQ.filter((f) => f.category === s.key).map((f) => (
                <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {f.q}
                    <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Container>
  );
}
