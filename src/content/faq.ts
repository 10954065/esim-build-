/**
 * FAQ content. Statements here must stay accurate to the implemented system and the
 * supplier's documented behaviour — never promise coverage, delivery or refunds that
 * the platform does not actually provide.
 */
export interface FaqItem {
  q: string;
  a: string;
  category: "esim" | "verification" | "rentals" | "payments" | "account";
}

export const FAQ: FaqItem[] = [
  {
    category: "esim",
    q: "Does a travel eSIM give me a phone number?",
    a: "No. The travel eSIMs we sell are data-only unless a plan explicitly says otherwise. They provide mobile internet but no ordinary phone number, so they cannot receive SMS verification codes or phone calls.",
  },
  {
    category: "esim",
    q: "How do I install my eSIM?",
    a: "After your payment is verified and the supplier issues your eSIM, open the order in your dashboard. Scan the QR code from another screen, or enter the activation details manually. Device-specific steps for iPhone and Android are shown on the same page.",
  },
  {
    category: "esim",
    q: "When does my plan's validity start?",
    a: "Validity rules are set by the network. Depending on the plan, the validity period starts either when the eSIM is installed or when it first connects at your destination.",
  },
  {
    category: "esim",
    q: "Can I reinstall an eSIM after deleting it?",
    a: "Usually not. Most eSIM profiles can be installed only once. Keep the eSIM on your device until your trip is over, even if you switch it off.",
  },
  {
    category: "verification",
    q: "Will every service accept a temporary number?",
    a: "No. Some services block temporary or virtual numbers. We show the supplier's reported delivery rate, but delivery of a code is never guaranteed.",
  },
  {
    category: "verification",
    q: "What happens if no SMS arrives?",
    a: "Each number is valid for a limited time set by the supplier. If no SMS arrives, you can cancel the activation (when the supplier allows it) or let it expire. When the supplier confirms a refund for an activation that received no SMS, we refund your payment automatically.",
  },
  {
    category: "verification",
    q: "Who can see my verification messages?",
    a: "Only you, from your signed-in dashboard. Messages are encrypted in our database, are never shown on public pages, and are not included in email subject lines or previews.",
  },
  {
    category: "rentals",
    q: "What is the difference between a verification number and a rental?",
    a: "A verification number is a one-time activation for receiving a code from a single service within a short time limit. A rental keeps a number assigned to you for a chosen term (for example 7 or 30 days) so you can receive SMS throughout that period.",
  },
  {
    category: "rentals",
    q: "Do rentals renew automatically?",
    a: "No. We never auto-renew rentals. We remind you before a rental expires so you can decide whether to buy another term.",
  },
  {
    category: "payments",
    q: "When am I charged, and in which currency?",
    a: "You see the final amount and currency before you pay. Your order is fulfilled only after our server verifies the payment with the payment provider — a success message in your browser alone never triggers delivery.",
  },
  {
    category: "payments",
    q: "How do refunds work?",
    a: "Refunds go back to your original payment method through the payment provider. A refund is marked complete only after the provider confirms it. See the refund policy for which cases are eligible.",
  },
  {
    category: "account",
    q: "Can I delete my account?",
    a: "Yes. Request deletion from your profile. We delete or anonymise personal data except records we must keep for financial, legal and fraud-prevention obligations.",
  },
];
