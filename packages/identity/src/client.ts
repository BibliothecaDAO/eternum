import * as Data from "effect/Data";
import * as Schema from "effect/Schema";
import * as Result from "effect/Result";
import { resolveEndpoint } from "@realms-world/chain";
import {
  parseNotificationPreferences,
  type NotificationPreferences,
  type PushRegistration,
} from "@bibliothecadao/notifications";
import { SOCIAL_PROVIDERS, type SocialProvider } from "./account-rules";
import { TICKET_TIERS } from "./campaigns";
import type { SiwsTypedData } from "./siws";
import { buildSiwsMessage, payoutWalletStatement } from "./siws";
import type { IdentityChainId, Session } from "./types";

export type SignTypedData = (message: SiwsTypedData) => Promise<string[]>;

/** One device change on the player's gameplay account on one shard, for the guardian to approve. */
export interface DeviceChangeRequest {
  chainId: string;
  account: string;
  action: "ADD" | "REVOKE";
  deviceKey: string;
  counter: number;
}

/** A refusal the identity service names, such as `INVALID_OTP` or `WALLET_LINKED_ELSEWHERE`. */
export class IdentityRequestError extends Data.TaggedError("IdentityRequestError")<{
  status: number;
  code: string | undefined;
  message: string;
}> {
  constructor(status: number, code?: string, message = code ?? `Identity request failed with status ${status}`) {
    super({ status, code, message });
  }
}

export class IdentityUnavailable extends Data.TaggedError("IdentityUnavailable")<{
  cause: unknown;
}> {
  readonly message = "Identity service unavailable";
}

export class IdentityInvalidResponse extends Data.TaggedError("IdentityInvalidResponse")<{
  status: number;
  cause: unknown;
}> {
  readonly message = "Identity service returned an invalid response";
}

/** The one fetch call the identity client makes; a browser's fetch, or a tool's that keeps the session cookie. */
export type IdentityFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface IdentityClientOptions {
  /** The identity API root: `/api` when it is served under the page's own origin, or an absolute URL. */
  apiUrl: string;
  fetch?: IdentityFetch;
}

export interface WalletDeployment {
  classHash: string;
  salt: string;
  constructorCalldata: string[];
}

export interface SignInOptions {
  deployment?: WalletDeployment;
  address: string;
  chainId: IdentityChainId;
  domain: string;
  uri: string;
  signTypedData: SignTypedData;
  statement?: string;
}

const sessionSchema = Schema.NullOr(
  Schema.Struct({
    session: Schema.Struct({ id: Schema.String, expiresAt: Schema.String, userId: Schema.String }),
    user: Schema.Struct({
      id: Schema.String,
      realmsId: Schema.String,
      name: Schema.String,
      email: Schema.String,
      walletLinkedAt: Schema.optional(Schema.NullOr(Schema.Number)),
      address: Schema.optional(Schema.NullOr(Schema.String)),
      emailVerified: Schema.optional(Schema.Boolean),
      suggestedName: Schema.optional(Schema.NullOr(Schema.String)),
      image: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  }),
);
const refusalSchema = Schema.Struct({
  error: Schema.optional(Schema.String),
  code: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
});
const pushConfigurationSchema = Schema.Union([
  Schema.Struct({ enabled: Schema.Literal(false) }),
  Schema.Struct({
    enabled: Schema.Literal(true),
    publicKey: Schema.String,
    gameAlerts: Schema.Boolean,
    directMessages: Schema.Boolean,
  }),
]);
const acknowledgementSchema = Schema.Record(Schema.String, Schema.Unknown);
/** The account's default wallet: its address and the passkey that owns it, made on `origin` for `rpId`. */
const defaultWalletSchema = Schema.Struct({
  address: Schema.String,
  credentialId: Schema.String,
  publicKeyX: Schema.String,
  origin: Schema.String,
  rpId: Schema.String,
});
export type DefaultWallet = typeof defaultWalletSchema.Type;
/** A passkey just made in the browser: its credential id and its public key (SubjectPublicKeyInfo), base64url. */
export interface NewPasskey {
  credentialId: string;
  publicKey: string;
}
/** One call a default wallet makes, as the paymaster builds it. */
export interface WalletCallRequest {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
}
/**
 * A default wallet's execution as the paymaster built it, SNIP-12 typed data for the passkey to sign, with the network
 * fee it pays itself in the wallet's gas token (hex wei): about `estimated`, at most `max`. No fee: the step is
 * sponsored (a recovery's cancel).
 */
const preparedWalletCallSchema = Schema.Struct({
  typedData: Schema.Record(Schema.String, Schema.Unknown),
  fee: Schema.NullOr(Schema.Struct({ estimated: Schema.String, max: Schema.String })),
});
export type PreparedWalletCall = typeof preparedWalletCallSchema.Type;
/** An account's Blitz build orders as saved: their book is the game's to read, with its own build order reader. */
const savedBuildOrdersSchema = Schema.Struct({ owner: Schema.String, revision: Schema.Number, book: Schema.Unknown });
export type SavedBuildOrders = typeof savedBuildOrdersSchema.Type;
/** An account's ticket to a campaign, told to that account only. */
const campaignTicketSchema = Schema.Struct({
  campaign: Schema.String,
  tier: Schema.Literals(TICKET_TIERS),
});
export type CampaignTicket = typeof campaignTicketSchema.Type;
/** What opens a new ticket: the code a flyer carried, or a friend's referral link. */
export type CampaignOpening = { code: string } | { referral: string };
/**
 * The account's referral link to a campaign, told to that account only: its code, what its friends can still earn it
 * (a ticket for a free home, golden for a Devcon one, nothing more), each friend's public name and progress, and what
 * they earned it so far.
 */
/**
 * The inviter's referral link as identity settles it. `home`: no ticket (free), a ticket not on a home yet (ticket), a
 * founded Devcon home the confirmed board shows regular (devcon) or golden (golden), or a claim from elsewhere (held).
 * `goldenPending`: golden earned on a Devcon home the board does not show golden yet.
 */
const campaignReferralSchema = Schema.Struct({
  code: Schema.String,
  home: Schema.Literals(["free", "ticket", "devcon", "golden", "held"]),
  tier: Schema.NullOr(Schema.Literals(TICKET_TIERS)),
  goldenPending: Schema.Boolean,
  link: Schema.Struct({ counted: Schema.Number, golden: Schema.Boolean }),
  friends: Schema.Array(
    Schema.Struct({
      name: Schema.NullOr(Schema.String),
      state: Schema.Literals(["signed", "founded", "counted", "excluded"]),
      golden: Schema.Boolean,
    }),
  ),
  earned: Schema.Struct({ ticket: Schema.Boolean, golden: Schema.Boolean }),
});
export type CampaignReferral = typeof campaignReferralSchema.Type;

const readJson = async <T>(response: Response, decode: (value: unknown) => T): Promise<T> => {
  if (!response.ok) throw await requestFailure(response);
  try {
    return decode(await response.json());
  } catch (cause) {
    throw new IdentityInvalidResponse({ status: response.status, cause });
  }
};

const requestFailure = async (response: Response): Promise<IdentityRequestError> => {
  try {
    const payload = Schema.decodeUnknownResult(refusalSchema)(await response.json());
    if (Result.isSuccess(payload)) {
      const { error, code, message } = payload.success;
      return new IdentityRequestError(response.status, error ?? code ?? message, message ?? error ?? code);
    }
  } catch {
    /* HTTP status remains authoritative when a refusal has no JSON body. */
  }
  return new IdentityRequestError(response.status);
};
const decode = Schema.decodeUnknownSync;

const resolveApiUrl = (apiUrl: string): string =>
  apiUrl.startsWith("/")
    ? apiUrl.replace(/\/$/, "")
    : resolveEndpoint(apiUrl, { name: "identity API URL", browserFacing: true });

export const createIdentityClient = ({ apiUrl, fetch = globalThis.fetch }: IdentityClientOptions) => {
  const api = resolveApiUrl(apiUrl);
  const request = async (path: string, init?: RequestInit) => {
    try {
      return await fetch(`${api}${path}`, {
        ...init,
        credentials: "include",
        headers: { "content-type": "application/json", ...init?.headers },
      });
    } catch (cause) {
      throw new IdentityUnavailable({ cause });
    }
  };

  const getSession = async (): Promise<Session | null> => {
    const response = await request("/auth/get-session", { method: "GET" });
    return response.status === 401 ? null : await readJson(response, decode(sessionSchema));
  };

  /** Changes the chosen username or portrait; the server answers 422 with its reason when a name breaks a rule. */
  const updateUser = async (body: { name?: string; image?: string | null }): Promise<void> => {
    const response = await request("/auth/update-user", { method: "POST", body: JSON.stringify(body) });
    if (response.ok) return;
    throw await requestFailure(response);
  };

  const signOut = async (): Promise<void> => {
    const response = await request("/auth/sign-out", { method: "POST", body: JSON.stringify({}) });
    if (!response.ok) {
      throw await requestFailure(response);
    }
  };

  const requireSession = async (): Promise<Session> => {
    const session = await getSession();
    if (!session) throw new IdentityRequestError(401, "SESSION_NOT_CREATED");
    return session;
  };

  /** A Sign in with Starknet proof: the server's nonce in a SNIP-12 message the wallet signs. */
  const siwsProof = async (options: SignInOptions, linking = false) => {
    const nonceResponse = await request("/auth/siws/nonce", {
      method: "POST",
      body: JSON.stringify({ address: options.address }),
    });
    const { nonce, realmsId } = await readJson(
      nonceResponse,
      decode(Schema.Struct({ nonce: Schema.String, realmsId: Schema.optional(Schema.String) })),
    );
    if (linking && !realmsId)
      throw new IdentityInvalidResponse({ status: nonceResponse.status, cause: "Missing realmsId" });
    const message = buildSiwsMessage({
      ...options,
      nonce,
      ...(linking ? { statement: payoutWalletStatement(realmsId!) } : {}),
    });
    return {
      address: options.address,
      message: JSON.stringify(message),
      signature: await options.signTypedData(message),
      ...(linking && options.deployment ? { deployment: options.deployment } : {}),
    };
  };

  /**
   * Signs in with a wallet on a server that still offers it: only the DAO pages' own server (apps/web), until J5 moves
   * them. Players never sign in with a wallet; the identity Worker has no such route.
   */
  const signIn = async (options: SignInOptions): Promise<Session> => {
    await readJson(
      await request("/auth/siws/verify", { method: "POST", body: JSON.stringify(await siwsProof(options)) }),
      decode(acknowledgementSchema),
    );
    return requireSession();
  };

  /**
   * Links the wallet to the signed-in Realms account, replacing the wallet it had; the server refuses a wallet another
   * account holds.
   */
  const linkWallet = async (options: SignInOptions & { code: string }): Promise<string> => {
    const linked = await readJson(
      await request("/auth/siws/link", {
        method: "POST",
        body: JSON.stringify({ ...(await siwsProof(options, true)), otp: options.code }),
      }),
      decode(Schema.Struct({ address: Schema.String })),
    );
    return linked.address;
  };

  /** Unlinks the account's wallet, freeing it for another account. */
  const unlinkWallet = async (code: string): Promise<void> => {
    await readJson(
      await request("/auth/siws/unlink", { method: "POST", body: JSON.stringify({ otp: code }) }),
      decode(Schema.Struct({ address: Schema.Null })),
    );
  };

  /** The sign-in providers linked to the signed-in account, such as "discord". */
  const listSignInProviders = async (): Promise<string[]> =>
    (
      await readJson(
        await request("/auth/list-accounts", { method: "GET" }),
        decode(Schema.Array(Schema.Struct({ providerId: Schema.String }))),
      )
    ).map((account) => account.providerId);

  /** Emails a one-time sign-in code; the service limits how many an address and a client get a minute. */
  const sendSignInCode = async (email: string): Promise<{ success: true; expires_at: number }> => {
    return readJson(
      await request("/auth/email-otp/send-verification-otp", {
        method: "POST",
        body: JSON.stringify({ email, type: "sign-in" }),
      }),
      decode(Schema.Struct({ success: Schema.Literal(true), expires_at: Schema.Number })),
    );
  };

  /** Signs in with an emailed code; an email's first sign-in creates its Realms account. */
  const signInWithCode = async (email: string, code: string): Promise<Session> => {
    await readJson(
      await request("/auth/sign-in/email-otp", { method: "POST", body: JSON.stringify({ email, otp: code }) }),
      decode(acknowledgementSchema),
    );
    return requireSession();
  };

  /**
   * Signs in with the code a provider's sign-in finished in another browser showed; only the browser that started it can.
   */
  const claimSocialHandoff = async (code: string): Promise<Session> => {
    await readJson(
      await request("/auth/social-handoff", { method: "POST", body: JSON.stringify({ code }) }),
      decode(Schema.Struct({ success: Schema.Literal(true) })),
    );
    return requireSession();
  };

  /**
   * Where to send the player to sign in with a provider; it returns them to `returnTo`, signed in, or with an `error`
   * query parameter when sign-in did not complete. Finished in another browser, it shows a code there for
   * `claimSocialHandoff`.
   */
  const socialSignInUrl = async (provider: SocialProvider, returnTo: string): Promise<string> => {
    const started = await readJson(
      await request("/auth/sign-in/social", {
        method: "POST",
        body: JSON.stringify({ provider, callbackURL: returnTo, errorCallbackURL: returnTo }),
      }),
      decode(Schema.Struct({ url: Schema.String })),
    );
    return started.url;
  };

  /** The guardian's `[r, s]` over one device change on the signed-in player's own account. */
  const approveDeviceChange = async (change: DeviceChangeRequest): Promise<string[]> => {
    const approved = await readJson(
      await request("/devices", { method: "POST", body: JSON.stringify(change) }),
      decode(Schema.Struct({ signature: Schema.mutable(Schema.Array(Schema.String)) })),
    );
    return approved.signature;
  };

  /** The account's default wallet, null while it has none. */
  const readDefaultWallet = async (): Promise<DefaultWallet | null> =>
    (
      await readJson(
        await request("/auth/wallet/default", { method: "GET", cache: "no-store" }),
        decode(Schema.Struct({ wallet: Schema.NullOr(defaultWalletSchema) })),
      )
    ).wallet;
  /**
   * Makes the account's default wallet from a new passkey (or keeps the one it has) and writes it as the payout wallet:
   * on a fresh sign-in at once, else with an emailed code (`CODE_REQUIRED` asks for one).
   */
  const createDefaultWallet = async (input: { passkey?: NewPasskey; code?: string }): Promise<DefaultWallet> =>
    (
      await readJson(
        await request("/auth/wallet/default", {
          method: "POST",
          body: JSON.stringify({
            ...(input.passkey ? { passkey: input.passkey } : {}),
            ...(input.code ? { otp: input.code } : {}),
          }),
        }),
        decode(Schema.Struct({ wallet: defaultWalletSchema })),
      )
    ).wallet;
  /** The outside execution of these calls as the paymaster built it, with the fee it pays (PreparedWalletCall). */
  const buildDefaultWalletCall = async (calls: WalletCallRequest[]): Promise<PreparedWalletCall> =>
    readJson(
      await request("/auth/wallet/default/build", { method: "POST", body: JSON.stringify({ calls }) }),
      decode(preparedWalletCallSchema),
    );
  /** Sends the signed execution through the paymaster; its transaction hash. */
  const executeDefaultWalletCall = async (typedData: Record<string, unknown>, ownerSignature: string[]) =>
    (
      await readJson(
        await request("/auth/wallet/default/execute", {
          method: "POST",
          body: JSON.stringify({ typedData, ownerSignature }),
        }),
        decode(Schema.Struct({ transactionHash: Schema.String })),
      )
    ).transactionHash;

  /**
   * Starts a lost passkey's recovery of the default wallet: `passkey`, just made on this device, owns it 7 days from
   * now unless the passkey that owns it today cancels. Takes the account's emailed code; the escape's transaction hash.
   */
  const startWalletRecovery = async (input: { passkey: NewPasskey; code: string }) =>
    (
      await readJson(
        await request("/auth/wallet/default/recovery", {
          method: "POST",
          body: JSON.stringify({ passkey: input.passkey, otp: input.code }),
        }),
        decode(Schema.Struct({ transactionHash: Schema.String })),
      )
    ).transactionHash;

  const getNotificationPreferences = async (): Promise<NotificationPreferences> =>
    readJson(
      await request("/notifications/preferences", { method: "GET", cache: "no-store" }),
      parseNotificationPreferences,
    );
  const saveNotificationPreferences = async (
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences> => {
    const response = await request("/notifications/preferences", {
      method: "POST",
      body: JSON.stringify(preferences),
    });
    if (response.status === 409)
      throw new IdentityRequestError(
        409,
        "preference_conflict",
        "Preferences changed on another device. Reload them before saving again.",
      );
    if (response.status === 403 || response.status === 401)
      throw new IdentityRequestError(
        response.status,
        "unauthorized",
        "Your account changed or signed out. Reload your preferences.",
      );
    return readJson(response, parseNotificationPreferences);
  };

  const getBuildOrders = async (): Promise<SavedBuildOrders> =>
    readJson(await request("/build-orders", { method: "GET", cache: "no-store" }), decode(savedBuildOrdersSchema));
  /** Saves over the revision it read; a refused order comes back with the game's reason, in the player's words. */
  const saveBuildOrders = async (saved: SavedBuildOrders): Promise<SavedBuildOrders> => {
    const response = await request("/build-orders", { method: "POST", body: JSON.stringify(saved) });
    if (response.status === 409)
      throw new IdentityRequestError(
        409,
        "build_order_conflict",
        "Your build orders changed on another device. Reload them before saving again.",
      );
    if (response.status === 403 || response.status === 401)
      throw new IdentityRequestError(response.status, "unauthorized", "Your account changed or signed out.");
    return readJson(response, decode(savedBuildOrdersSchema));
  };

  /**
   * Takes the account's one ticket to a campaign, from its flyer's code or a friend's referral link; without either, the
   * ticket it holds. Again, the same ticket.
   */
  const redeemCampaignTicket = async (campaign: string, opening: CampaignOpening | null): Promise<CampaignTicket> =>
    readJson(
      await request("/campaigns/redeem", { method: "POST", body: JSON.stringify({ campaign, ...opening }) }),
      decode(campaignTicketSchema),
    );

  /** The account's referral link to a campaign and what its friends earned it, settled as it is read. */
  const campaignReferral = async (campaign: string): Promise<CampaignReferral> =>
    readJson(
      await request(`/campaigns/referral?campaign=${encodeURIComponent(campaign)}`, {
        method: "GET",
        cache: "no-store",
      }),
      decode(campaignReferralSchema),
    );

  /** The public name of the inviter behind a referral link; null when they chose none. */
  const campaignReferrer = async (campaign: string, code: string): Promise<string | null> =>
    (
      await readJson(
        await request(`/campaigns/referral/${encodeURIComponent(code)}?campaign=${encodeURIComponent(campaign)}`, {
          method: "GET",
        }),
        decode(Schema.Struct({ name: Schema.NullOr(Schema.String) })),
      )
    ).name;

  const pushRequest = async <T>(
    action: string,
    decode: (value: unknown) => T,
    body?: unknown,
    options: { keepalive?: boolean } = {},
  ): Promise<T> =>
    readJson(
      await request(`/notifications/push/${action}`, {
        ...(body === undefined
          ? { method: "GET", cache: "no-store" as const }
          : { method: "POST", body: JSON.stringify(body) }),
        keepalive: options.keepalive,
        signal: AbortSignal.timeout(10_000),
      }),
      decode,
    );
  return {
    getSession,
    signIn,
    linkWallet,
    unlinkWallet,
    listSignInProviders,
    /** The providers the identity service offers, in the sheet's order. */
    availableSignInProviders: async (): Promise<SocialProvider[]> => {
      const { providers } = await readJson(
        await request("/auth/providers", { method: "GET" }),
        decode(Schema.Struct({ providers: Schema.Array(Schema.Literals(SOCIAL_PROVIDERS)) })),
      );
      return SOCIAL_PROVIDERS.filter((provider) => providers.includes(provider));
    },
    sendSignInCode,
    signInWithCode,
    claimSocialHandoff,
    socialSignInUrl,
    approveDeviceChange,
    readDefaultWallet,
    createDefaultWallet,
    buildDefaultWalletCall,
    executeDefaultWalletCall,
    startWalletRecovery,
    signOut,
    updateUser,
    getNotificationPreferences,
    saveNotificationPreferences,
    getBuildOrders,
    saveBuildOrders,
    redeemCampaignTicket,
    campaignReferral,
    campaignReferrer,
    getPushConfiguration: () => pushRequest("config", decode(pushConfigurationSchema)),
    registerPushSubscription: (input: PushRegistration) =>
      pushRequest("subscribe", decode(Schema.Struct({ id: Schema.String })), input),
    getPushSubscriptionStatus: (owner: string, id: string) =>
      pushRequest(
        "status",
        decode(
          Schema.Struct({ registered: Schema.Boolean, gameAlerts: Schema.Boolean, directMessages: Schema.Boolean }),
        ),
        {
          owner,
          id,
        },
      ),
    /** Whether a game is in view on this device, and the device's time zone, which a push's times use. */
    setPushGameForeground: (owner: string, id: string, foreground: boolean, timeZone: string) =>
      pushRequest(
        "foreground",
        decode(Schema.Struct({ foreground: Schema.Boolean })),
        { owner, id, foreground, timeZone },
        { keepalive: true },
      ),
    /** The device's first push, "Alerts are on", sent the moment its game alerts turn on. */
    sendAlertsOn: (owner: string, id: string) =>
      pushRequest("alerts-on", decode(Schema.Struct({ status: Schema.String })), { owner, id }),
    revokePushSubscription: (id: string, token: string) =>
      pushRequest("revoke", decode(Schema.Struct({ revoked: Schema.Boolean })), { id, token }),
  };
};
