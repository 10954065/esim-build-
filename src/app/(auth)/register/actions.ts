"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { clientIp, consumeRateLimit } from "@/server/rate-limit";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.email("Enter a valid email").max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(10, "Use at least 10 characters").max(128),
  acceptTerms: z.literal(true, { error: "You must accept the terms and acceptable use policy" }),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Registration runs server-side so terms acceptance is enforced and recorded, and so we can
 * rate limit by IP and email. The response never reveals whether an email already exists.
 */
export async function registerAction(input: RegisterInput): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { name, email, password } = parsed.data;
  const h = await headers();
  const ip = clientIp(h);

  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit(`register:ip:${ip}`, 10, 3600),
    consumeRateLimit(`register:email:${email}`, 3, 3600),
  ]);
  if (!byIp.ok || !byEmail.ok) {
    return { ok: false, error: "Too many attempts to create an account. Please try again later." };
  }

  try {
    const result = await auth.api.signUpEmail({ body: { name, email, password, callbackURL: "/dashboard" }, headers: h });
    const now = new Date();
    await db.userProfile.upsert({
      where: { userId: result.user.id },
      update: { acceptedTermsAt: now, acceptedAupAt: now },
      create: { userId: result.user.id, acceptedTermsAt: now, acceptedAupAt: now },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof APIError) {
      const code = (err.body as { code?: string } | undefined)?.code ?? "";
      // Do not reveal that the account exists (prevents account enumeration).
      if (code.includes("USER_ALREADY_EXISTS") || /already exists/i.test(err.message)) return { ok: true };
      if (code.includes("PASSWORD")) return { ok: false, error: err.message, fieldErrors: { password: err.message } };
      return { ok: false, error: err.message || "We could not create your account." };
    }
    logger.error("registration failed", { err });
    return { ok: false, error: "We could not create your account. Please try again." };
  }
}
