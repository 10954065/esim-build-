import { siteConfig } from "@/lib/site";

/**
 * Email templates. Rules:
 * - Never include OTP codes, SMS text or eSIM activation strings in any email.
 * - Subjects stay generic; sensitive details are only visible in the signed-in dashboard.
 * - All interpolated values are HTML-escaped.
 */

export interface RenderedEmail {
  template: string;
  subject: string;
  html: string;
  text: string;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }): { html: string; text: string } {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${esc(p)}</p>`).join("");
  const button = cta
    ? `<p style="margin:22px 0"><a href="${esc(cta.url)}" style="background:#1e2a4a;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${esc(cta.label)}</a></p>
       <p style="font-size:12px;color:#667085;word-break:break-all">If the button does not work, open: ${esc(cta.url)}</p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f4;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1d2433">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="font-weight:700;font-size:16px;margin:0 0 24px">${esc(siteConfig.name)}</p>
    <div style="background:#fff;border:1px solid #e6e6ea;border-radius:12px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${body}${button}
    </div>
    <p style="font-size:12px;color:#667085;margin-top:20px">You received this email because of activity on your ${esc(siteConfig.name)} account. Need help? ${esc(siteConfig.supportEmail)}</p>
  </div></body></html>`;
  const text = [title, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.url}`] : [])].join("\n");
  return { html, text };
}

const app = (path: string) => `${siteConfig.url.replace(/\/$/, "")}${path}`;

export const templates = {
  verifyEmail(input: { name: string; url: string }): RenderedEmail {
    return {
      template: "verify-email",
      subject: `Confirm your email for ${siteConfig.name}`,
      ...layout(
        "Confirm your email address",
        [`Hi ${input.name},`, "Please confirm your email address to activate your account. This link expires in 24 hours."],
        { label: "Confirm email", url: input.url },
      ),
    };
  },
  resetPassword(input: { name: string; url: string }): RenderedEmail {
    return {
      template: "reset-password",
      subject: "Reset your password",
      ...layout(
        "Reset your password",
        [`Hi ${input.name},`, "We received a request to reset your password. This link expires in 1 hour. If you did not ask for this, you can ignore this email."],
        { label: "Choose a new password", url: input.url },
      ),
    };
  },
  passwordChanged(input: { name: string }): RenderedEmail {
    return {
      template: "security-password-changed",
      subject: "Security alert: your password was changed",
      ...layout("Your password was changed", [
        `Hi ${input.name},`,
        "The password for your account was just changed and other sessions were signed out.",
        `If this was not you, reset your password immediately and contact ${siteConfig.supportEmail}.`,
      ]),
    };
  },
  twoFactorChanged(input: { name: string; enabled: boolean }): RenderedEmail {
    return {
      template: "security-2fa-changed",
      subject: `Security alert: two-factor authentication ${input.enabled ? "enabled" : "disabled"}`,
      ...layout(`Two-factor authentication ${input.enabled ? "enabled" : "disabled"}`, [
        `Hi ${input.name},`,
        `Two-factor authentication was ${input.enabled ? "turned on" : "turned off"} for your account.`,
        "If you did not make this change, secure your account and contact support.",
      ]),
    };
  },
  orderPaid(input: { name: string; orderNumber: string; orderId: string; total: string }): RenderedEmail {
    return {
      template: "order-paid",
      subject: `Payment received for order ${input.orderNumber}`,
      ...layout(
        "Payment confirmed",
        [`Hi ${input.name},`, `We have verified your payment of ${input.total} for order ${input.orderNumber}. We are now preparing your order with our supplier.`],
        { label: "View order", url: app(`/dashboard/orders/${input.orderId}`) },
      ),
    };
  },
  esimReady(input: { name: string; orderNumber: string; esimId: string }): RenderedEmail {
    return {
      template: "esim-ready",
      subject: `Your eSIM for order ${input.orderNumber} is ready`,
      ...layout(
        "Your eSIM is ready to install",
        [
          `Hi ${input.name},`,
          "Your eSIM has been issued. For your security, the QR code and activation details are only shown in your dashboard.",
          "Install it while connected to Wi-Fi, and do not delete it from your phone after installing.",
        ],
        { label: "Open installation page", url: app(`/dashboard/esims/${input.esimId}`) },
      ),
    };
  },
  numberIssued(input: { name: string; orderNumber: string; path: string; kind: "verification" | "rental" }): RenderedEmail {
    return {
      template: input.kind === "rental" ? "rental-issued" : "verification-issued",
      subject: `Your ${input.kind === "rental" ? "rental number" : "verification number"} is ready`,
      ...layout(
        input.kind === "rental" ? "Your rental number is active" : "Your verification number is ready",
        [`Hi ${input.name},`, `Order ${input.orderNumber} has been fulfilled. Open your dashboard to see the number and incoming messages.`],
        { label: "Open dashboard", url: app(input.path) },
      ),
    };
  },
  smsReceived(input: { name: string; path: string }): RenderedEmail {
    return {
      template: "sms-received",
      subject: "New message received",
      ...layout("You have a new message", [`Hi ${input.name},`, "A new SMS arrived on one of your numbers. Open your dashboard to read it."], {
        label: "Read message",
        url: app(input.path),
      }),
    };
  },
  fulfilmentProblem(input: { name: string; orderNumber: string; orderId: string }): RenderedEmail {
    return {
      template: "fulfilment-problem",
      subject: `Update on order ${input.orderNumber}`,
      ...layout(
        "We could not complete your order yet",
        [
          `Hi ${input.name},`,
          `Our supplier could not complete order ${input.orderNumber}. Your payment is safe. We are reviewing it now and will either complete the order or refund you in full.`,
        ],
        { label: "View order", url: app(`/dashboard/orders/${input.orderId}`) },
      ),
    };
  },
  refundUpdate(input: { name: string; orderNumber: string; amount: string; status: "PENDING" | "COMPLETED" | "FAILED" }): RenderedEmail {
    const copy = {
      PENDING: "We have started a refund. It has been submitted to the payment provider and will appear once they process it.",
      COMPLETED: "Your refund has been confirmed by the payment provider. Depending on your bank it may take a few business days to show.",
      FAILED: "The payment provider could not process your refund. Our team has been notified and will contact you.",
    }[input.status];
    return {
      template: `refund-${input.status.toLowerCase()}`,
      subject: `Refund ${input.status === "COMPLETED" ? "completed" : "update"} for order ${input.orderNumber}`,
      ...layout(`Refund of ${input.amount}`, [`Hi ${input.name},`, copy], { label: "View refunds", url: app("/dashboard/refunds") }),
    };
  },
  rentalExpiring(input: { name: string; phoneLast4: string; expiresAt: string; rentalId: string }): RenderedEmail {
    return {
      template: "rental-expiring",
      subject: "Your rental number expires soon",
      ...layout(
        "Your rental is about to expire",
        [`Hi ${input.name},`, `Your number ending in ${input.phoneLast4} expires on ${input.expiresAt}. Rentals never renew automatically.`],
        { label: "View rental", url: app(`/dashboard/rentals`) },
      ),
    };
  },
  ticketUpdate(input: { name: string; ticketNumber: string; ticketId: string }): RenderedEmail {
    return {
      template: "ticket-update",
      subject: `Update on support ticket ${input.ticketNumber}`,
      ...layout("Our team replied to your ticket", [`Hi ${input.name},`, `There is a new reply on ticket ${input.ticketNumber}.`], {
        label: "View ticket",
        url: app(`/dashboard/support/${input.ticketId}`),
      }),
    };
  },
};
