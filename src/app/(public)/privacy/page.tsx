import type { Metadata } from "next";
import { ProsePage } from "@/components/common/prose";
import { RETENTION } from "@/lib/retention";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <ProsePage eyebrow="Legal" title="Privacy policy" updated="22 October 2026" intro="We collect only what we need to deliver your products, process payments, prevent abuse and meet legal obligations.">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account:</strong> name, email address, password (stored as a secure hash), optional country, two factor settings.</li>
          <li><strong>Orders:</strong> products purchased, prices, supplier references and order status history.</li>
          <li><strong>Payments:</strong> payment provider references, amount, currency and status. We never receive or store full card details.</li>
          <li><strong>Issued products:</strong> eSIM activation details (encrypted), assigned phone numbers, and SMS received on your numbers (encrypted).</li>
          <li><strong>Security logs:</strong> IP address and device information when you sign in and for sensitive actions.</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>To provide and support your orders, verify payments, issue refunds, secure accounts, prevent fraud and abuse, and comply with law. We do not sell personal data and do not use it for third party advertising.</p>
      </section>
      <section>
        <h2>Who we share it with</h2>
        <ul>
          <li>Our telecommunications supplier, to fulfil orders (they receive the product details needed to issue eSIMs and numbers, not your name or email).</li>
          <li>Our payment provider, to process payments and refunds.</li>
          <li>Our email provider, to send account and order emails. Emails never contain SMS content or eSIM activation codes.</li>
          <li>Authorities, when legally required.</li>
        </ul>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>SMS message content: deleted {RETENTION.smsContentDays} days after it is received.</li>
          <li>Phone numbers on finished verification sessions and rentals: anonymised {RETENTION.phoneNumberDays} days after the session ends.</li>
          <li>Unpaid, abandoned orders: deleted after {RETENTION.abandonedOrderDays} days.</li>
          <li>Payment, refund and accounting records: {RETENTION.financialRecordYears} years, to meet financial obligations.</li>
          <li>Security and audit logs: {RETENTION.auditLogYears} years.</li>
          <li>eSIM activation details: kept while your account exists so you can reinstall information, and removed when your account is deleted.</li>
        </ul>
      </section>
      <section>
        <h2>Security</h2>
        <p>Sensitive data is encrypted at rest, access is restricted by role, privileged actions are recorded in an audit log, and all traffic uses HTTPS.</p>
      </section>
      <section>
        <h2>Your rights</h2>
        <p>
          You can view your data in your dashboard, correct your profile, and request deletion of your account from your profile page. We
          keep records we are legally required to retain. Contact {siteConfig.supportEmail} for any privacy request.
        </p>
      </section>
    </ProsePage>
  );
}
