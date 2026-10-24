import { describe, expect, it } from "vitest";
import { signPayload } from "../signature";
import { createSandboxAdapter, SANDBOX_SIGNATURE_HEADER } from "./adapter";

const fixedNow = new Date("2026-10-22T12:00:00Z");
const adapter = createSandboxAdapter({ signingSecret: "sbx", priceCurrency: "USD", now: () => fixedNow });

describe("sandbox supplier", () => {
  it("is explicitly marked as sandbox", () => {
    expect(adapter.mode).toBe("SANDBOX");
    expect(adapter.code).toBe("sandbox");
  });

  it("issues obviously fake, non-installable eSIM activation codes", async () => {
    const [pkg] = await adapter.esim.listPackages("ES");
    const order = await adapter.esim.orderEsim({ packageCode: pkg!.packageCode, quantity: 1 });
    const profile = order.profiles[0]!;
    expect(profile.activationCode).toMatch(/^LPA:1\$sandbox-smdp\.invalid\$DEMO-/);
    // Order references are stateless and round-trip.
    const again = await adapter.esim.getEsimOrder(order.supplierOrderId);
    expect(again.profiles[0]?.activationCode).toBe(profile.activationCode);
  });

  it("simulates supplier failures for test packages and services", async () => {
    await expect(adapter.esim.orderEsim({ packageCode: "SBX-ES-TEST-FAIL", quantity: 1 })).rejects.toMatchObject({
      kind: "PROVIDER_FAILED",
    });
    await expect(
      adapter.verification.orderActivation({ countryCode: "US", serviceSlug: "demo-fail", providerTier: "EXTRA" }),
    ).rejects.toMatchObject({ kind: "PROVIDER_FAILED" });
  });

  it("uses fictional phone number ranges only", async () => {
    const offer = (await adapter.verification.getOffers({ countryCode: "US" })).find((o) => o.stock > 0 && o.serviceSlug !== "demo-fail")!;
    const act = await adapter.verification.orderActivation({
      countryCode: "US",
      serviceSlug: offer.serviceSlug,
      providerTier: offer.providerTier,
    });
    expect(act.phoneNumber).toMatch(/^\+1555010\d{2}$/);
    expect(act.state).toBe("WAITING");
    expect(act.messages).toEqual([]);

    const uk = await adapter.rentals.orderRental({ countryCode: "GB", term: "7d", rentalType: "unlimited" });
    expect(uk.phoneNumber).toMatch(/^\+447700900\d{3}$/);
  });

  it("expires activations after their window", async () => {
    const offer = (await adapter.verification.getOffers({ countryCode: "GB" })).find((o) => o.stock > 0 && o.serviceSlug !== "demo-fail")!;
    const act = await adapter.verification.orderActivation({
      countryCode: "GB",
      serviceSlug: offer.serviceSlug,
      providerTier: offer.providerTier,
    });
    const later = createSandboxAdapter({
      signingSecret: "sbx",
      priceCurrency: "USD",
      now: () => new Date(fixedNow.getTime() + 21 * 60 * 1000),
    });
    expect((await later.verification.getActivation(act.supplierOrderId)).state).toBe("EXPIRED");
  });

  it("rejects forged references", async () => {
    await expect(adapter.verification.getActivation("ord_real_123")).rejects.toMatchObject({ kind: "NOT_FOUND" });
  });

  it("verifies sandbox webhooks with its own header and secret", () => {
    const raw = JSON.stringify({ id: "evt", event: "ping", data: {} });
    const t = Math.floor(Date.now() / 1000);
    const ok = new Headers({ [SANDBOX_SIGNATURE_HEADER]: signPayload(raw, "sbx", t) });
    expect(adapter.webhooks.verifyAndParse(raw, ok).kind).toBe("ping");
    const wrongHeader = new Headers({ "x-1001sms-signature": signPayload(raw, "sbx", t) });
    expect(() => adapter.webhooks.verifyAndParse(raw, wrongHeader)).toThrow();
  });
});
