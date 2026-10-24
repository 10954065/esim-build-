import "server-only";
import type { HeaderUser } from "@/components/site/site-header";

/**
 * Minimal signed-in user info for the public header.
 * Replaced by the Better Auth session lookup in the authentication phase.
 */
export async function getHeaderUser(): Promise<HeaderUser | null> {
  return null;
}
