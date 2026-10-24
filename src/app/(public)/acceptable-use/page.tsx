import type { Metadata } from "next";
import { ProsePage } from "@/components/common/prose";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Acceptable use policy", alternates: { canonical: "/acceptable-use" } };

export default function AcceptableUsePage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Acceptable use policy"
      updated="22 October 2026"
      intro="Our numbers and eSIMs are for legitimate personal and business use. This policy explains what is not allowed."
    >
      <section>
        <h2>You must not use our products to</h2>
        <ul>
          <li>Commit fraud, create fraudulent accounts, or engage in scams or phishing.</li>
          <li>Impersonate another person or organisation.</li>
          <li>Take over or access accounts that do not belong to you, or bypass another person&apos;s two-factor authentication.</li>
          <li>Evade identity verification, age checks, sanctions screening, bans or restrictions imposed by a service.</li>
          <li>Intercept or attempt to receive messages intended for someone else.</li>
          <li>Send spam or bulk unsolicited messages, or harass anyone.</li>
          <li>Break the law or the terms of our supplier or the service you are verifying with.</li>
        </ul>
      </section>
      <section>
        <h2>Service rules</h2>
        <p>
          Many services restrict or prohibit virtual numbers. You are responsible for checking that a service allows the use you intend. A
          number working once does not mean the service permits it.
        </p>
      </section>
      <section>
        <h2>Enforcement</h2>
        <p>
          We apply purchase limits and monitor for abuse. We may refuse orders, cancel active numbers without refund, suspend accounts and
          cooperate with lawful requests from authorities when this policy is breached.
        </p>
      </section>
      <section>
        <h2>Reporting abuse</h2>
        <p>Report suspected misuse of one of our numbers to {siteConfig.supportEmail} or through a support ticket with the category “Report abuse”.</p>
      </section>
    </ProsePage>
  );
}
