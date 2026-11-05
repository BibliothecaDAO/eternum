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
import type { SendWalletNotice } from "./wallet-changes";
import { siws } from "./siws-plugin";
import { defaultWallet } from "./default-wallet-plugin";
import { identityL2Configuration, identityProvider, latestL2GasPrice } from "./l2";
import { avnuPaymaster } from "./paymaster";
import { readAttemptState, readWalletEscape, type RecoveryServices } from "./wallet-recovery";
import { isUndeployedWallet, verifyWalletOnL2, type VerifyWalletSignature } from "./wallet-signature";

/**
 * What the identity service reaches outside its database: the environment L2 for wallet signatures and deployments,
 * the email provider, and the paymaster of default wallets.
 */
interface IdentityServices extends Pick<WalletChainServices, "paymaster" | "isDeployed" | "readEscape"> {
  verifyWalletSignature: VerifyWalletSignature;
  sendSignInCode: SendSignInCode;
  sendWalletNotice?: SendWalletNotice;
}

type WalletChainEnv = Pick<
  IdentityEnv,
  "ENVIRONMENT" | "L2_RPC_URL" | "MARKETPLACE_API_URL" | "AVNU_PAYMASTER_API_KEY"
>;
type IdentityServiceEnv = WalletChainEnv & Pick<IdentityEnv, "RESEND_API_KEY" | "BASE_URL">;

/** What default wallets need of the chain: its paymaster (sponsoring only with our key), and reads of a wallet. */
type WalletChainServices = Pick<
  RecoveryServices,
  "paymaster" | "isDeployed" | "readEscape" | "readAttemptState" | "succeeded"
>;

export const walletChainServicesOf = (env: WalletChainEnv): WalletChainServices => {
  const provider = () => identityProvider(env);
  return {
    paymaster: avnuPaymaster(env.AVNU_PAYMASTER_API_KEY, () => latestL2GasPrice(provider())),
    isDeployed: async (address) => !(await isUndeployedWallet(provider(), address)),
    readEscape: (address) => readWalletEscape(provider(), address),
    readAttemptState: (address, newOwner, nonce) => readAttemptState(provider(), address, newOwner, nonce),
    succeeded: async (transactionHash) =>
      (await provider().waitForTransaction(transactionHash, { retryInterval: 2_000 })).isSuccess(),
  };
};

const identityServicesOf = (env: IdentityServiceEnv): IdentityServices => ({
  verifyWalletSignature: verifyWalletOnL2(env),
  sendSignInCode: resendSignInCodes(env.RESEND_API_KEY, env.BASE_URL),
  ...walletChainServicesOf(env),
});

/**
 * A new user's id is fixed here and never changes: the Realms id derives from it and places the player's account on
 * every shard. A new user starts with its id as its name, which reads as "not chosen" until they pick one, offered
 * their Discord name as a suggestion, and with no portrait: a sign-in provider's avatar is not one of ours. Nothing is
 * suggested from an email: the name shows on every leaderboard, and an email's local part is often the player's own.
 *
 * An account is keyed by its email, and a later email-code sign-in for that address opens it, so no account is created
 * on an email its provider has not verified: an email code proves the address, and Discord passes its own verified flag.
 */
const assignRealmsIdentity = async (user: Record<string, unknown>) => {
  if (user.emailVerified !== true) throw new APIError("FORBIDDEN", { message: "email_not_verified" });
  const id = crypto.randomUUID().replaceAll("-", "");
  const suggestedName = suggestedNameOf(typeof user.name === "string" ? user.name : "");
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
        paymaster: services.paymaster,
        isDeployed: services.isDeployed,
        readEscape: services.readEscape,
        checkCode,
        sendNotice: sendWalletNotice,
      }),
    ],
  });
};

export type IdentityAuth = ReturnType<typeof createIdentityAuth>;
