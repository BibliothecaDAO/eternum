import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "env";

import { db } from "@realms-world/db/client";

import { siws } from "./auth/auth-siws-plugin";

// Create Starknet auth plug

export const auth = betterAuth({
  baseURL: env.VITE_BASE_URL ?? "http://localhost:3000",
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

  plugins: [siws({ domain: env.VITE_BASE_URL ?? "http://localhost:3000" })],
});
