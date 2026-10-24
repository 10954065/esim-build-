import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { after } from "next/server";
import { writeAudit } from "@/server/audit";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { templates } from "@/server/email/templates";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";

/**
 * Better Auth configuration.
 * - Email + password with mandatory email verification and password reset.
 * - Database sessions (httpOnly, secure in production), 14-day lifetime, daily refresh.
 * - TOTP two-factor authentication (required for staff in production — see session.ts).
 * - Admin plugin for bans and role management (roles: user, support, finance, admin).
 * - Auth endpoints are rate limited with database storage.
 * - Google sign-in only when both credentials are configured.
 */

const env = getEnv();
const log = logger.child({ component: "auth" });

/** Run work after the response is sent (avoids timing side channels and slow responses). */
function background(task: () => Promise<unknown>): void {
  const run = () => task().catch((err: unknown) => log.error("background auth task failed", { err }));
  try {
    after(run);
  } catch {
    void run();
  }
}

export const auth = betterAuth({
  appName: env.APP_NAME,
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      background(() => sendEmail({ to: user.email, userId: user.id, email: templates.resetPassword({ name: user.name, url }) }));
    },
    onPasswordReset: async ({ user }) => {
      background(async () => {
        await writeAudit({ actorId: user.id, action: "auth.password_reset", entityType: "user", entityId: user.id });
        await sendEmail({ to: user.email, userId: user.id, email: templates.passwordChanged({ name: user.name }) });
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      background(() => sendEmail({ to: user.email, userId: user.id, email: templates.verifyEmail({ name: user.name, url }) }));
    },
  },

  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : undefined,

  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 15,
  },

  rateLimit: {
    enabled: env.APP_ENV !== "test",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 10 },
      "/request-password-reset": { window: 3600, max: 5 },
      "/forget-password": { window: 3600, max: 5 },
      "/send-verification-email": { window: 3600, max: 5 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
      "/change-password": { window: 3600, max: 10 },
    },
  },

  advanced: {
    useSecureCookies: env.APP_ENV === "production" || env.APP_URL.startsWith("https://"),
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.userProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
        },
      },
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const session = ctx.context.session;
      if (!session) return;
      const user = session.user;
      if (ctx.path === "/change-password") {
        background(async () => {
          await writeAudit({ actorId: user.id, action: "auth.password_changed", entityType: "user", entityId: user.id });
          await sendEmail({ to: user.email, userId: user.id, email: templates.passwordChanged({ name: user.name }) });
        });
      }
      if (ctx.path === "/two-factor/enable" || ctx.path === "/two-factor/disable") {
        const enabled = ctx.path === "/two-factor/enable";
        background(async () => {
          await writeAudit({ actorId: user.id, action: enabled ? "auth.2fa_enabled" : "auth.2fa_disabled", entityType: "user", entityId: user.id });
          await sendEmail({ to: user.email, userId: user.id, email: templates.twoFactorChanged({ name: user.name, enabled }) });
        });
      }
    }),
  },

  plugins: [
    twoFactor({ issuer: env.APP_NAME }),
    admin({ defaultRole: "user", adminRoles: ["admin"], impersonationSessionDuration: 60 * 30 }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
