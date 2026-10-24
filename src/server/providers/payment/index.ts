import "server-only";
import { getEnv } from "@/server/env";
import { createPaystackGateway } from "./paystack";
import { createSandboxGateway } from "./sandbox";
import { PaymentGatewayError, type PaymentGateway } from "./types";

/** Resolve the configured payment gateway. Secrets are read here, server-side only. */
let cached: PaymentGateway | null | undefined;

export function getPaymentGateway(): PaymentGateway {
  if (cached === undefined) {
    const env = getEnv();
    if (env.PAYMENT_PROVIDER === "paystack") {
      cached = createPaystackGateway({ secretKey: env.PAYSTACK_SECRET_KEY!, baseUrl: env.PAYSTACK_BASE_URL });
    } else if (env.PAYMENT_PROVIDER === "sandbox") {
      cached = createSandboxGateway({ signingSecret: env.SANDBOX_SIGNING_SECRET, appUrl: env.APP_URL });
    } else {
      cached = null;
    }
  }
  if (!cached) throw new PaymentGatewayError("Payments are not configured", { retryable: false, uncertain: false });
  return cached;
}

export function __resetPaymentGatewayForTests(gateway?: PaymentGateway | null): void {
  cached = gateway === undefined ? undefined : gateway;
}

export * from "./types";
