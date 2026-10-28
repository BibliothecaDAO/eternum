import * as Data from "effect/Data";
import * as Schema from "effect/Schema";
import * as Result from "effect/Result";
import { resolveEndpoint } from "@realms-world/chain";
import {
  parseNotificationPreferences,
  type NotificationPreferences,
  type PushRegistration,
} from "@bibliothecadao/notifications";
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
/** An account's Blitz build orders as saved: their book is the game's to read, with its own build order reader. */
const savedBuildOrdersSchema = Schema.Struct({ owner: Schema.String, revision: Schema.Number, book: Schema.Unknown });
export type SavedBuildOrders = typeof savedBuildOrdersSchema.Type;
/** An account's ticket to a campaign, told to that account only. */
const campaignTicketSchema = Schema.Struct({
  campaign: Schema.String,
  tier: Schema.Literals(TICKET_TIERS),
});
export type CampaignTicket = typeof campaignTicketSchema.Type;

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
   * Signs in with the code a Discord sign-in finished in another browser showed; only the browser that started it can.
   */
  const claimDiscordHandoff = async (code: string): Promise<Session> => {
    await readJson(
      await request("/auth/discord-handoff", { method: "POST", body: JSON.stringify({ code }) }),
      decode(Schema.Struct({ success: Schema.Literal(true) })),
    );
    return requireSession();
  };

  /**
   * Where to send the player to sign in with Discord; Discord returns them to `returnTo`, signed in, or with an
   * `error` query parameter when sign-in did not complete. Finished in another browser, it shows a code there for
   * `claimDiscordHandoff`.
   */
  const discordSignInUrl = async (returnTo: string): Promise<string> => {
    const started = await readJson(
      await request("/auth/sign-in/social", {
        method: "POST",
        body: JSON.stringify({ provider: "discord", callbackURL: returnTo, errorCallbackURL: returnTo }),
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

  /** Takes the account's one ticket to a campaign, from its flyer's code or none; again, the same ticket. */
  const redeemCampaignTicket = async (campaign: string, code: string | null): Promise<CampaignTicket> =>
    readJson(
      await request("/campaigns/redeem", { method: "POST", body: JSON.stringify({ campaign, code }) }),
      decode(campaignTicketSchema),
    );

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
    availableSignInProviders: async () =>
      (
        await readJson(
          await request("/auth/providers", { method: "GET" }),
          decode(Schema.Struct({ providers: Schema.mutable(Schema.Array(Schema.String)) })),
        )
      ).providers,
    sendSignInCode,
    signInWithCode,
    claimDiscordHandoff,
    discordSignInUrl,
    approveDeviceChange,
    signOut,
    updateUser,
    getNotificationPreferences,
    saveNotificationPreferences,
    getBuildOrders,
    saveBuildOrders,
    redeemCampaignTicket,
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
    /** Whether a game is in view on this device, and the device's time zone, which a push's times and quiet hours use. */
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
