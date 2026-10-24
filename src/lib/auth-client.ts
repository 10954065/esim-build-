"use client";

import { adminClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser auth client. Talks only to this app's /api/auth endpoints (same origin). */
export const authClient = createAuthClient({
  plugins: [twoFactorClient(), adminClient()],
});
