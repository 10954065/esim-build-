import "server-only";
import type { HeaderUser } from "@/components/site/site-header";
import { isStaffRole } from "./permissions";
import { getOptionalUser } from "./session";

/** Minimal signed-in user info for the public header (no sensitive fields). */
export async function getHeaderUser(): Promise<HeaderUser | null> {
  const user = await getOptionalUser();
  if (!user) return null;
  return { name: user.name, isStaff: isStaffRole(user.role) };
}
