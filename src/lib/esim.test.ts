import { describe, expect, it } from "vitest";
import { appleInstallLink, isDemoActivation, parseLpa } from "./esim";

describe("parseLpa", () => {
  it("splits an LPA activation string into SM-DP+ address and matching id", () => {
    expect(parseLpa("LPA:1$rsp-eu.example.com$ABCDEF123456")).toEqual({ smdpAddress: "rsp-eu.example.com", matchingId: "ABCDEF123456" });
    expect(parseLpa("  lpa:1$smdp.example$MID$1$extra  ")).toEqual({ smdpAddress: "smdp.example", matchingId: "MID" });
  });

  it.each([null, undefined, "", "LPA:1$only-address", "LPA:2$a$b", "https://example.com/qr.png"])("rejects %s", (code) => {
    expect(parseLpa(code)).toBeNull();
  });
});

describe("isDemoActivation", () => {
  it("recognises sandbox codes on the reserved .invalid domain", () => {
    expect(isDemoActivation("LPA:1$sandbox-smdp.invalid$DEMO123")).toBe(true);
  });

  it("does not flag real codes or empty values", () => {
    expect(isDemoActivation("LPA:1$rsp-eu.example.com$ABC")).toBe(false);
    expect(isDemoActivation("LPA:1$invalid.example.com$ABC")).toBe(false);
    expect(isDemoActivation(null)).toBe(false);
  });
});

describe("appleInstallLink", () => {
  it("URL-encodes the full activation code into Apple's provisioning link", () => {
    expect(appleInstallLink("LPA:1$smdp.example$A B")).toBe("https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA%3A1%24smdp.example%24A%20B");
  });
});
