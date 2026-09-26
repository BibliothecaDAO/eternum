import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import {
  IDENTITY_PORTRAITS,
  nameRuleViolation,
  SIGN_IN_CODE_LENGTH,
  SIGN_IN_CODE_SECONDS,
  suggestedNameOf,
} from "@realms-world/identity";
import { RpcProvider, verifyMessageInStarknet } from "starknet";

import type { IdentityEnv } from "./env";
import { isNameTaken } from "./names";
import { realmsIdOf } from "./realms-id";
import { resendSignInCodes, type SendSignInCode } from "./sign-in-codes";
import { siws, type VerifyWalletSignature } from "./siws-plugin";

const DAY_SECONDS = 24 * 60 * 60;

/** What the identity service reaches outside its database: mainnet for wallet signatures, and the email provider. */
interface IdentityServices {
  verifyWalletSignature: VerifyWalletSignature;
  sendSignInCode: SendSignInCode;
}

const identityServicesOf = (env: Pick<IdentityEnv, "IDENTITY_RPC_URL" | "RESEND_API_KEY">): IdentityServices => ({
  verifyWalletSignature: verifyOnMainnet(env.IDENTITY_RPC_URL),
  sendSignInCode: resendSignInCodes(env.RESEND_API_KEY),
});

/** Mainnet wallets verify their own signatures; the identity RPC asks the wallet contract. */
const verifyOnMainnet =
  (rpcUrl: string): VerifyWalletSignature =>
  (message, signature, address) =>
    verifyMessageInStarknet(
      new RpcProvider({ nodeUrl: rpcUrl }),
      message as unknown as Parameters<typeof verifyMessageInStarknet>[1],
      signature,
      address,
    );

/**
 * A new user's id is fixed here and never changes: the Realms id derives from it and places the player's account on
 * every shard. A new user starts with its id as its name, which reads as "not chosen" until they pick one, offered
 * their Discord name or their email's local part as a suggestion, and with no portrait: a sign-in provider's avatar is
 * not one of ours.
 */
const assignRealmsIdentity = async (user: Record<string, unknown>) => {
  const id = crypto.randomUUID().replaceAll("-", "");
  const providerName = typeof user.name === "string" ? user.name : "";
  const emailName = typeof user.email === "string" ? (user.email.split("@")[0] ?? "") : "";
  const suggestedName = suggestedNameOf(providerName) ?? suggestedNameOf(emailName);
  return { data: { ...user, id, name: id, suggestedName, image: null, realmsId: realmsIdOf(id) } };
};

/**
 * An account a player signed in to through Discord or an email code they received. Only such an account approves a
 * device; an account from before those were the only ways in does not.
 */
export const hasVerifiedSignIn = async (db: D1Database, userId: string): Promise<boolean> =>
  (await db
    .prepare(
      `SELECT 1 FROM "user" WHERE "id" = ?1 AND "emailVerified" = 1
       UNION SELECT 1 FROM "account" WHERE "userId" = ?1 AND "providerId" = 'discord' LIMIT 1`,
    )
    .bind(userId)
    .first()) !== null;

/**
 * The identity service: sign-in with Discord or an emailed code, the first of which creates the account, and wallets
 * linked to an account. Name changes pass one chokepoint: the
 * update hook validates format and pre-checks uniqueness for every writer; the unique index on lower(name) is the
 * race-proof guarantee.
 */
export const createIdentityAuth = (
  env: Pick<
    IdentityEnv,
    | "DB"
    | "BASE_URL"
    | "BETTER_AUTH_SECRET"
    | "IDENTITY_RPC_URL"
    | "DISCORD_CLIENT_ID"
    | "DISCORD_CLIENT_SECRET"
    | "RESEND_API_KEY"
  >,
  services: IdentityServices = identityServicesOf(env),
) =>
  betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BASE_URL,
    basePath: "/api/auth",
    database: env.DB,
    // A month, renewed by a day's use, so a phone stays signed in. Every session read comes from the database: a cached
    // copy of the account went stale for an hour after a wallet link or a name change made on another device.
    session: { expiresIn: 30 * DAY_SECONDS, updateAge: DAY_SECONDS },
    socialProviders: {
      discord: { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET },
    },
    // Other realms.party services set better-auth's default cookie names for the whole domain; a browser sends that
    // older cookie first, and it would hide this service's session. Our cookies carry their own name.
    advanced: { cookiePrefix: "realms-identity" },
    user: {
      additionalFields: {
        realmsId: { type: "string", unique: true, required: false, input: false },
        suggestedName: { type: "string", required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: { before: assignRealmsIdentity },
        update: {
          before: async (data, ctx) => {
            if (typeof data.name === "string") {
              const violation = nameRuleViolation(data.name);
              if (violation) throw new APIError("UNPROCESSABLE_ENTITY", { message: `NAME_INVALID:${violation}` });
              if (await isNameTaken(env.DB, data.name, ctx?.context.session?.user.id)) {
                throw new APIError("UNPROCESSABLE_ENTITY", { message: "NAME_TAKEN" });
              }
            }
            if (typeof data.image === "string" && !(IDENTITY_PORTRAITS as readonly string[]).includes(data.image)) {
              throw new APIError("UNPROCESSABLE_ENTITY", { message: "PORTRAIT_INVALID" });
            }
            return { data };
          },
        },
      },
    },
    plugins: [
      // A sign-in code for an email signs in its account, and creates it on the email's first sign-in.
      emailOTP({
        otpLength: SIGN_IN_CODE_LENGTH,
        expiresIn: SIGN_IN_CODE_SECONDS,
        allowedAttempts: 3,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "sign-in") throw new APIError("BAD_REQUEST", { message: "SIGN_IN_CODES_ONLY" });
          await services.sendSignInCode(email, otp);
        },
      }),
      siws({ origin: env.BASE_URL, verifySignature: services.verifyWalletSignature }),
    ],
  });

export type IdentityAuth = ReturnType<typeof createIdentityAuth>;
