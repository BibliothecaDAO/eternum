import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "env";

import { db } from "@realms-world/db/client";

import { siws } from "./auth/auth-siws-plugin";

const cookieDomain = process.env.IDENTITY_COOKIE_DOMAIN;
if (!cookieDomain) {
  throw new Error("IDENTITY_COOKIE_DOMAIN is required");
}

export const auth = betterAuth({
  baseURL: env.VITE_BASE_URL,
  trustedOrigins: [env.VITE_BASE_URL, env.VITE_PUBLIC_GAME_ORIGIN],
  advanced: {
    useSecureCookies: true,
    crossSubDomainCookies: {
      enabled: true,
      domain: cookieDomain,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // https://www.better-auth.com/docs/concepts/session-management#session-caching
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60, // 60 minutes
    },
  },

  plugins: [siws({ domain: env.VITE_BASE_URL })],
});
