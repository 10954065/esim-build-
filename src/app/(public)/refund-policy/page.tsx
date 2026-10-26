import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/common/prose";

export const metadata: Metadata = { title: "Refund policy", alternates: { canonical: "/refund-policy" } };

export default function RefundPolicyPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Refund policy"
      updated="22 October 2026"
      intro="Refunds go back to your original payment method through our payment provider. A refund is shown as completed only after the provider confirms it."
    >
      <section>
        <h2>Automatic refunds</h2>
        <ul>
          <li><strong>Order could not be fulfilled:</strong> if our supplier definitively fails to issue your product after payment, we refund the full amount.</li>
          <li><strong>Verification number with no SMS:</strong> if no SMS arrives and the supplier confirms the activation was refunded (after you cancel, or after it expires), we refund you automatically.</li>
          <li><strong>Rental cancelled within the supplier&apos;s window:</strong> when the supplier accepts a cancellation and confirms a refund, we refund you.</li>
        </ul>
      </section>
      <section>
        <h2>Reviewed refunds</h2>
        <p>
          Some situations need a person to look at them, for example when the supplier&apos;s response was unclear, or an eSIM could not be
          installed. Open a <Link href="/dashboard/support/new">support ticket</Link> linked to the order and we will review it.
        </p>
      </section>
      <section>
        <h2>Not refundable</h2>
        <ul>
          <li>eSIMs that have been installed or activated, or whose activation details have been issued, unless the eSIM is faulty.</li>
          <li>Verification numbers that received an SMS, even if the service later rejected the code.</li>
          <li>Purchases for devices that do not support eSIM or are locked to a carrier.</li>
          <li>Orders cancelled because of a breach of our <Link href="/acceptable-use">acceptable use policy</Link>.</li>
        </ul>
      </section>
      <section>
        <h2>Timing</h2>
        <p>Once our payment provider processes a refund, it can take several business days to appear, depending on your bank or mobile money provider.</p>
      </section>
      <section>
        <h2>Your statutory rights</h2>
        <p>This policy does not limit any rights you have under applicable consumer protection law.</p>
      </section>
    </ProsePage>
  );
}
