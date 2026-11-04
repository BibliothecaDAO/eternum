import { encodeChainName, environmentL2 } from "@realms-world/chain";
import { betterAuth, type AuthContext } from "better-auth";
import { APIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import {
  IDENTITY_PORTRAITS,
  nameRuleViolation,
  SIGN_IN_CODE_LENGTH,
  SESSION_RENEWAL_SECONDS,
  SESSION_SECONDS,
  SIGN_IN_CODE_SECONDS,
  suggestedNameOf,
} from "@realms-world/identity";

import { socialProvidersOf, type IdentityEnv } from "./env";
import { isNameTaken } from "./names";
import { realmsIdOf } from "./realms-id";
import { resendSignInCodes, type SendSignInCode } from "./sign-in-codes";
import { resendWalletNotices } from "./wallet-notices";
import { siws } from "./siws-plugin";
import { defaultWallet } from "./default-wallet-plugin";
import { identityL2Configuration, identityProvider } from "./l2";
import { avnuSponsor, type Sponsor } from "./sponsor";
import { isUndeployedWallet, verifyWalletOnL2, type VerifyWalletSignature } from "./wallet-signature";

/**
 * What the identity service reaches outside its database: the environment L2 for wallet signatures and deployments,
 * the email provider, and the sponsor of default wallets' gas.
 */
interface IdentityServices {
  verifyWalletSignature: VerifyWalletSignature;
  sendSignInCode: SendSignInCode;
  sendWalletNotice?: (email: string, address: string | null, id: string) => Promise<void>;
  sponsor: Sponsor | null;
  isDeployed: (address: string) => Promise<boolean>;
}

type IdentityServiceEnv = Pick<
  IdentityEnv,
  "ENVIRONMENT" | "L2_RPC_URL" | "MARKETPLACE_API_URL" | "RESEND_API_KEY" | "BASE_URL" | "AVNU_PAYMASTER_API_KEY"
>;

const identityServicesOf = (env: IdentityServiceEnv): IdentityServices => ({
  verifyWalletSignature: verifyWalletOnL2(env),
  sendSignInCode: resendSignInCodes(env.RESEND_API_KEY, env.BASE_URL),
  sponsor: env.AVNU_PAYMASTER_API_KEY ? avnuSponsor(env.AVNU_PAYMASTER_API_KEY) : null,
  isDeployed: async (address) => !(await isUndeployedWallet(identityProvider(env), address)),
});

/**
 * A new user's id is fixed here and never changes: the Realms id derives from it and places the player's account on
 * every shard. A new user starts with its id as its name, which reads as "not chosen" until they pick one, offered
 * their Discord name or their email's local part as a suggestion, and with no portrait: a sign-in provider's avatar is
 * not one of ours.
 *
 * An account is keyed by its email, and a later email-code sign-in for that address opens it, so no account is created
 * on an email its provider has not verified: an email code proves the address, and Discord passes its own verified flag.
 */
const assignRealmsIdentity = async (user: Record<string, unknown>) => {
  if (user.emailVerified !== true) throw new APIError("FORBIDDEN", { message: "email_not_verified" });
  const id = crypto.randomUUID().replaceAll("-", "");
  const providerName = typeof user.name === "string" ? user.name : "";
  const emailName = typeof user.email === "string" ? (user.email.split("@")[0] ?? "") : "";
  const suggestedName = suggestedNameOf(providerName) ?? suggestedNameOf(emailName);
  return { data: { ...user, id, name: id, suggestedName, image: null, realmsId: realmsIdOf(id) } };
};

/**
 * An account whose email is verified, by an email code or by Discord's own check. Only such an account approves a
 * device; a Discord sign-in alone proves nothing about the email the account is keyed by.
 */
export const hasVerifiedSignIn = async (db: D1Database, userId: string): Promise<boolean> =>
  (await db.prepare(`SELECT 1 FROM "user" WHERE "id" = ?1 AND "emailVerified" = 1`).bind(userId).first()) !== null;

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
    | "ENVIRONMENT"
    | "L2_RPC_URL"
    | "MARKETPLACE_API_URL"
    | "DISCORD_CLIENT_ID"
    | "DISCORD_CLIENT_SECRET"
    | "RESEND_API_KEY"
    | "AVNU_PAYMASTER_API_KEY"
    | "GUARDIAN"
  >,
  services: IdentityServices = identityServicesOf(env),
) => {
  const sendWalletNotice = services.sendWalletNotice ?? resendWalletNotices(env.RESEND_API_KEY, env.BASE_URL);
  const checkCode = (context: AuthContext, email: string, otp: string) =>
    emailCodes.endpoints.checkVerificationOTP({ context, body: { email, otp, type: "sign-in" } });
  const emailCodes = emailOTP({
    otpLength: SIGN_IN_CODE_LENGTH,
    expiresIn: SIGN_IN_CODE_SECONDS,
    allowedAttempts: 3,
    storeOTP: "hashed",
    sendVerificationOTP: async ({ email, otp, type }) => {
      if (type !== "sign-in") throw new APIError("BAD_REQUEST", { message: "SIGN_IN_CODES_ONLY" });
      await services.sendSignInCode(email, otp);
    },
  });
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BASE_URL,
    basePath: "/api/auth",
    database: env.DB,
    // A month, renewed by a day's use (account-rules.ts). Every session read comes from the database: a cached
    // copy of the account went stale for an hour after a wallet link or a name change made on another device.
    session: { expiresIn: SESSION_SECONDS, updateAge: SESSION_RENEWAL_SECONDS },
    socialProviders: socialProvidersOf(env),
    // Other realms.party services set better-auth's default cookie names for the whole domain; a browser sends that
    // older cookie first, and it would hide this service's session. Our cookies carry their own name.
    advanced: { cookiePrefix: "realms-identity" },
    // Discord's return is held to the browser that started it by discord-handoff.ts, which a phone's switch to another
    // browser does not break; better-auth's own check refused that switch outright.
    account: { skipStateCookieCheck: true },
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
      emailCodes,
      siws({
        origin: env.BASE_URL,
        chainId: environmentL2(env.ENVIRONMENT).chain,
        verifySignature: services.verifyWalletSignature,
        db: env.DB,
        checkCode,
        sendNotice: sendWalletNotice,
      }),
      defaultWallet({
        origin: env.BASE_URL,
        chainId: encodeChainName(identityL2Configuration(env).chainId),
        db: env.DB,
        guardian: env.GUARDIAN,
        sponsor: services.sponsor,
        isDeployed: services.isDeployed,
        checkCode,
        sendNotice: sendWalletNotice,
      }),
    ],
  });
};

export type IdentityAuth = ReturnType<typeof createIdentityAuth>;
