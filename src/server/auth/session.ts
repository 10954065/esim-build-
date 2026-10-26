import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getEnv } from "@/server/env";
import { auth } from "./auth";
import { can, isRole, type Permission, type Role } from "./permissions";

/**
 * Server-side session access. These checks are the security boundary, the proxy and
 * hidden navigation are conveniences only.
 */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  twoFactorEnabled: boolean;
  banned: boolean;
}

export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string | null; twoFactorEnabled?: boolean | null; banned?: boolean | null };
  const user: SessionUser = {
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    role: isRole(u.role) ? u.role : "user",
    twoFactorEnabled: !!u.twoFactorEnabled,
    banned: !!u.banned,
  };
  return { session: session.session, user };
});

export async function getOptionalUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/** For pages: redirect to sign-in when unauthenticated; enforce verification and bans. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  if (s.user.banned) redirect("/login?error=account_suspended");
  if (!s.user.emailVerified) redirect(`/verify-email?email=${encodeURIComponent(s.user.email)}`);
  return s.user;
}

/** For pages in /admin: non-staff get a 404 so the admin area is not discoverable. */
export async function requireStaff(permission: Permission = "admin.access"): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (!can(user.role, "admin.access")) notFound();
  if (getEnv().APP_ENV === "production" && !user.twoFactorEnabled) redirect("/dashboard/security?require2fa=1");
  if (!can(user.role, permission)) notFound();
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "You are not allowed to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For server actions and route handlers: throw instead of redirecting. */
export async function assertUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s || s.user.banned || !s.user.emailVerified) throw new AuthorizationError("Please sign in with a verified account.");
  return s.user;
}

export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await assertUser();
  if (!can(user.role, permission)) throw new AuthorizationError();
  if (getEnv().APP_ENV === "production" && !user.twoFactorEnabled) {
    throw new AuthorizationError("Two factor authentication is required for staff actions.");
  }
  return user;
}
