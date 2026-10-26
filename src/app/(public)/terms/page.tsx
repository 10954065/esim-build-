import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/common/prose";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of service", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <ProsePage eyebrow="Legal" title="Terms of service" updated="22 October 2026" intro={`These terms govern your use of ${siteConfig.name} and the purchase of travel eSIMs, verification numbers and number rentals.`}>
      <section>
        <h2>1. The service</h2>
        <p>
          We resell digital telecommunications products supplied by third party providers: data only travel eSIM plans, temporary phone
          numbers for receiving SMS verification codes, and longer term number rentals. Product availability, coverage, speeds and number
          inventory are determined by our suppliers and the underlying networks and can change without notice.
        </p>
      </section>
      <section>
        <h2>2. Your account</h2>
        <p>You must provide accurate information, confirm your email address and keep your credentials secure. You are responsible for activity on your account.</p>
      </section>
      <section>
        <h2>3. Prices and payment</h2>
        <p>
          Prices are shown in the checkout currency before you pay and are fixed once an order is created. Payments are processed by our
          payment provider; we do not store card details. An order is fulfilled only after the payment is verified on our servers.
        </p>
      </section>
      <section>
        <h2>4. Delivery</h2>
        <ul>
          <li>eSIM activation details are delivered to your dashboard once issued by our supplier. You are responsible for checking device compatibility before purchase.</li>
          <li>Verification numbers are valid for a limited time set by the supplier. We do not guarantee that any service will accept a number or deliver a code.</li>
          <li>Rentals are valid for the purchased term and are never renewed automatically.</li>
        </ul>
      </section>
      <section>
        <h2>5. Acceptable use</h2>
        <p>
          You must comply with our <Link href="/acceptable-use">acceptable use policy</Link>, applicable law, and the rules of any service you
          use a number with. We may suspend accounts and cancel orders involved in fraud or abuse.
        </p>
      </section>
      <section>
        <h2>6. Refunds</h2>
        <p>Refunds are handled under our <Link href="/refund-policy">refund policy</Link>.</p>
      </section>
      <section>
        <h2>7. Liability</h2>
        <p>
          To the extent permitted by law, our liability for any order is limited to the amount you paid for it. We are not liable for losses
          caused by third party services rejecting numbers, network outages, or devices that do not support eSIM. Nothing in these terms
          limits rights you have under applicable consumer protection law.
        </p>
      </section>
      <section>
        <h2>8. Changes and contact</h2>
        <p>We may update these terms; the date above shows the latest version. Questions: {siteConfig.supportEmail}.</p>
      </section>
    </ProsePage>
  );
}
