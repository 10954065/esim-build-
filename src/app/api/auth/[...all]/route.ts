import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/auth";

// Better Auth endpoints (sign-in, sign-up, verification, reset, 2FA, sessions, admin).
export const { GET, POST } = toNextJsHandler(auth);
