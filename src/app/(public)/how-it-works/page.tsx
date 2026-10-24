import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/common/prose";

export const metadata: Metadata = { title: "How it works", description: "How buying a travel eSIM or a verification number works, from checkout to delivery.", alternates: { canonical: "/how-it-works" } };

export default function HowItWorksPage() {
  return (
    <ProsePage eyebrow="Guide" title="How it works" intro="Every purchase follows the same path: you choose, you pay, our server verifies the payment, and only then do we order from our supplier and deliver to your private dashboard.">
      <section>
        <h2>1. Choose a product</h2>
        <p>
          Browse <Link href="/esims">travel eSIMs</Link> by destination, or pick a country and service for a{" "}
          <Link href="/verification">verification number</Link>. Availability and supplier prices are refreshed from our supplier; the
          price you see is calculated on our servers.
        </p>
      </section>
      <section>
        <h2>2. Review and pay</h2>
        <p>
          At checkout you see the exact amount and currency. We re-check the supplier price for numbers just before you pay. You then
          pay on the payment provider&apos;s secure page — we never see or store your card details.
        </p>
      </section>
      <section>
        <h2>3. Server-side payment verification</h2>
        <p>
          The payment provider notifies our server with a signed message, and our server independently confirms the payment amount and
          currency. A success screen in your browser alone never releases a product.
        </p>
      </section>
      <section>
        <h2>4. Fulfilment</h2>
        <ul>
          <li><strong>eSIM:</strong> we order the plan from our supplier and store the activation details encrypted. When it is ready, the QR code and manual details appear in your dashboard.</li>
          <li><strong>Verification number:</strong> the supplier assigns a number with a time limit. Request the code from the service and watch for the SMS in your dashboard.</li>
          <li><strong>Rental:</strong> the number stays assigned to you for the term you bought. Rentals never renew automatically.</li>
        </ul>
      </section>
      <section>
        <h2>5. If something goes wrong</h2>
        <p>
          If our supplier cannot complete an order after payment, it is held for review and either completed or refunded in full.
          Verification sessions that receive no SMS are refunded once the supplier confirms the refund. Details are in our{" "}
          <Link href="/refund-policy">refund policy</Link>.
        </p>
      </section>
    </ProsePage>
  );
}
