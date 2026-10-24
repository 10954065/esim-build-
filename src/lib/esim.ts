/** Parse an LPA activation string: LPA:1$<SM-DP+ address>$<matching ID>[$...] */
export function parseLpa(code: string | null | undefined): { smdpAddress: string; matchingId: string } | null {
  if (!code) return null;
  const parts = code.trim().split("$");
  if (parts.length < 3 || !/^LPA:1$/i.test(parts[0]!)) return null;
  return { smdpAddress: parts[1]!, matchingId: parts[2]! };
}

/** Sandbox activation codes use the reserved .invalid TLD and can never be installed. */
export function isDemoActivation(code: string | null | undefined): boolean {
  return !!code && /\.invalid\$/i.test(code);
}

/**
 * Apple's documented universal link for installing an eSIM directly on an iPhone
 * (iOS 17.4+). Only offered for real (non-demo) activation codes.
 */
export function appleInstallLink(code: string): string {
  return `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(code)}`;
}
