import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@realms-world/db/client";

import { serverEnv } from "./env";
import { nameRuleViolation } from "./name-rules";
import { isNameTaken } from "./names";
import { siws } from "./siws-plugin";

const PORTRAIT_PATTERN = /^(0[1-9]|1[0-2])$/;

/**
 * The identity service for apps/realms — better-auth over the shared Postgres
 * with the ported SIWS plugin. Name changes pass one chokepoint: the database
 * hook below validates format and pre-checks uniqueness for every writer
 * (including better-auth's own /update-user); the functional unique index on
 * lower(name) remains the race-proof guarantee.
 */
export const auth = betterAuth({
  baseURL: serverEnv.VITE_BASE_URL,
  basePath: "/api/auth",
  trustedOrigins: [serverEnv.VITE_BASE_URL, serverEnv.VITE_PUBLIC_GAME_ORIGIN],
  advanced: {
    useSecureCookies: serverEnv.VITE_BASE_URL.startsWith("https:"),
    crossSubDomainCookies: {
      enabled: true,
      domain: serverEnv.IDENTITY_COOKIE_DOMAIN,
    },
  },
  database: drizzleAdapter(db, { provider: "pg" }),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60,
    },
  },
  databaseHooks: {
    user: {
      update: {
        before: async (data, ctx) => {
          if (typeof data.name === "string") {
            const violation = nameRuleViolation(data.name);
            if (violation) {
              throw new APIError("UNPROCESSABLE_ENTITY", { message: `NAME_INVALID:${violation}` });
            }
            const selfId = ctx?.context.session?.user.id;
            if (await isNameTaken(data.name, selfId)) {
              throw new APIError("UNPROCESSABLE_ENTITY", { message: "NAME_TAKEN" });
            }
          }
          if (typeof data.image === "string" && !PORTRAIT_PATTERN.test(data.image)) {
            throw new APIError("UNPROCESSABLE_ENTITY", { message: "PORTRAIT_INVALID" });
          }
          return { data };
        },
      },
    },
  },
  plugins: [siws({ domain: serverEnv.VITE_BASE_URL })],
});
