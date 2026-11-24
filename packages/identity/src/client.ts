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
import {
  DAY_SHARE_KINDS,
  INVITED_FRIEND_STATES,
  SHARE_CARD,
  SHARE_KINDS,
  type ShareChannel,
  type ShareKind,
} from "./shares";
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
/** The moments an account's interface has opened to and the lines it has been told, as sets of the game's own names. */
const openingProgressSchema = Schema.Struct({
  reached: Schema.Array(Schema.String),
  seen: Schema.Array(Schema.String),
});
export type OpeningProgress = typeof openingProgressSchema.Type;
const orderIntentSchema = Schema.Struct({
  order: Schema.NullOr(Schema.Number),
  members: Schema.Record(Schema.String, Schema.Number),
});
export type OrderIntent = typeof orderIntentSchema.Type;
const sealCodeSchema = Schema.Struct({ held: Schema.Boolean });
export const SEAL_CODE_REFUSALS = ["invalid_code", "code_unavailable"] as const;
export type SealCodeRefusal = (typeof SEAL_CODE_REFUSALS)[number];
export const isSealCodeRefusal = (code: string | undefined): code is SealCodeRefusal =>
  (SEAL_CODE_REFUSALS as readonly (string | undefined)[]).includes(code);
type SealCode = typeof sealCodeSchema.Type;

/**
 * A moment a player shares, as its link records it: its kind, the game it was played in, and which one (the day, or
 * the Aspect an invite names).
 */
export type ShareMoment =
  | { kind: ShareKind; chainId: string; gameId: number; moment: number }
  | { kind: "aspect"; chainId: null; gameId: null; moment: number };
export type DayShareMoment = {
  kind: (typeof DAY_SHARE_KINDS)[number];
  chainId: string;
  gameId: number;
  moment: number;
};
/** A shared link as a friend who opened it sees it: what it shares and who shared it (null: no public name). */
const sharedLinkFields = { moment: Schema.Number, name: Schema.NullOr(Schema.String) };
const openedShareSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literals(DAY_SHARE_KINDS), ...sharedLinkFields }),
  Schema.Struct({
    kind: Schema.Literal("aspect"),
    ...sharedLinkFields,
    order: Schema.NullOr(Schema.Number),
    members: Schema.NullOr(Schema.Number),
  }),
]);
export type OpenedShare = typeof openedShareSchema.Type;
/** The link a new account came by, as that account reads it: its kind, its game and its moment; null for none. */
const joinedShareSchema = Schema.NullOr(
  Schema.Union([
    Schema.Struct({
      kind: Schema.Literals(SHARE_KINDS),
      chainId: Schema.String,
      gameId: Schema.Number,
      moment: Schema.Number,
      name: Schema.NullOr(Schema.String),
    }),
    Schema.Struct({
      kind: Schema.Literal("aspect"),
      chainId: Schema.Null,
      gameId: Schema.Null,
      moment: Schema.Number,
      name: Schema.NullOr(Schema.String),
    }),
  ]),
);
export type JoinedShare = typeof joinedShareSchema.Type;
const shareTallySchema = Schema.Struct({
  links: Schema.Number,
  posted: Schema.Number,
  visits: Schema.Number,
  joined: Schema.Number,
  activated: Schema.Number,
  friendsPaid: Schema.Number,
  fragmentsEarned: Schema.Number,
});
export type ShareTally = typeof shareTallySchema.Type;
const ownInviteSchema = Schema.Struct({
  code: Schema.String,
  aspect: Schema.Number,
  chainId: Schema.NullOr(Schema.String),
  gameId: Schema.NullOr(Schema.Number),
});
export type OwnInvite = typeof ownInviteSchema.Type;
const invitedFriendsSchema = Schema.Struct({
  friends: Schema.Array(
    Schema.Struct({
      name: Schema.NullOr(Schema.String),
      joinedAt: Schema.Number,
      glory: Schema.NullOr(Schema.Number),
      state: Schema.Literals(INVITED_FRIEND_STATES),
    }),
  ),
});
export type InvitedFriends = typeof invitedFriendsSchema.Type;
const fragmentPriceSchema = Schema.Struct({
  fragments: Schema.Number,
  cents: Schema.Number,
  quote: Schema.NullOr(
    Schema.Struct({
      id: Schema.String,
      lordsWei: Schema.String,
      token: Schema.String,
      treasury: Schema.String,
      expiresAt: Schema.Number,
    }),
  ),
});
export type FragmentPrice = typeof fragmentPriceSchema.Type;
const fragmentPaymentSchema = Schema.Struct({
  state: Schema.Literals(["delivering", "delivered"]),
  fragments: Schema.optional(Schema.Number),
});
export type FragmentPayment = typeof fragmentPaymentSchema.Type;

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

  /**
   * Deletes the signed-in Realms account, confirmed by an emailed sign-in code (`sendSignInCode`). The session ends with
   * it; what the server keeps, and why, is listed on apps/realms/server/account-deletion.ts.
   */
  const deleteAccount = async (code: string): Promise<void> => {
    await readJson(
      await request("/account", { method: "DELETE", body: JSON.stringify({ otp: code }) }),
      decode(Schema.Struct({ deleted: Schema.Literal(true) })),
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

  const getOpeningProgress = async (): Promise<OpeningProgress> =>
    readJson(await request("/opening", { method: "GET", cache: "no-store" }), decode(openingProgressSchema));
  /** Adds moments to the account's sets; adding one it holds changes nothing. */
  const addOpeningProgress = async (additions: Partial<OpeningProgress>): Promise<OpeningProgress> =>
    readJson(
      await request("/opening", { method: "POST", body: JSON.stringify(additions) }),
      decode(openingProgressSchema),
    );

  const getOrderIntent = async (): Promise<OrderIntent> =>
    readJson(await request("/order-intent", { method: "GET", cache: "no-store" }), decode(orderIntentSchema));
  const chooseOrder = async (order: number): Promise<OrderIntent> =>
    readJson(
      await request("/order-intent", { method: "POST", body: JSON.stringify({ order }) }),
      decode(orderIntentSchema),
    );
  const getSealCode = async (): Promise<SealCode> =>
    readJson(await request("/seal-code", { method: "GET", cache: "no-store" }), decode(sealCodeSchema));
  const redeemSealCode = async (code: string): Promise<SealCode> =>
    readJson(await request("/seal-code", { method: "POST", body: JSON.stringify({ code }) }), decode(sealCodeSchema));

  /** The account's link for one moment, made on first ask and the same ever after. */
  const createShare = async (moment: DayShareMoment): Promise<string> =>
    (
      await readJson(
        await request("/shares", { method: "POST", body: JSON.stringify(moment) }),
        decode(Schema.Struct({ code: Schema.String })),
      )
    ).code;

  /** Records that the account posted its link; sent as the post opens, so it outlives the page leaving. */
  const sharePosted = async (code: string): Promise<void> => {
    const response = await request(`/shares/${encodeURIComponent(code)}/posted`, { method: "POST", keepalive: true });
    if (!response.ok) throw await requestFailure(response);
  };

  /** Hands identity the card the sheet drew for the account's link, which the link then unfurls as. */
  const uploadShareCard = async (code: string, image: Blob): Promise<void> => {
    const response = await request(`/shares/${encodeURIComponent(code)}/card`, {
      method: "PUT",
      headers: { "content-type": SHARE_CARD.type },
      body: image,
    });
    if (!response.ok) throw await requestFailure(response);
  };

  /**
   * A friend opens a shared link: the visit is recorded for this browser, with the channel the link was posted from
   * (null for a link that names none), and the link says what it shares.
   */
  const openShare = async (code: string, via: ShareChannel | null): Promise<OpenedShare> =>
    readJson(
      await request(`/shares/${encodeURIComponent(code)}/visit`, { method: "POST", body: JSON.stringify({ via }) }),
      decode(openedShareSchema),
    );

  /** The link this account came by (the first another player's that its browser opened before it was made); null for none. */
  const joinedShare = async (): Promise<JoinedShare> =>
    readJson(await request("/shares/joined", { method: "GET", cache: "no-store" }), decode(joinedShareSchema));

  const priceFragments = async (game: { chainId: string; gameId: number }, fragments: number): Promise<FragmentPrice> =>
    readJson(
      await request(
        `/shop/fragments?${new URLSearchParams({ chain: game.chainId, game: String(game.gameId), fragments: String(fragments) })}`,
        { method: "GET", cache: "no-store" },
      ),
      decode(fragmentPriceSchema),
    );

  const payFragments = async (quoteId: string, transactionHash: string): Promise<FragmentPayment> =>
    readJson(
      await request("/shop/fragments/pay", { method: "POST", body: JSON.stringify({ quoteId, transactionHash }) }),
      decode(fragmentPaymentSchema),
    );

  const fragmentPayment = async (transactionHash: string): Promise<FragmentPayment> =>
    readJson(
      await request(`/shop/fragments/pay/${encodeURIComponent(transactionHash)}`, { method: "GET", cache: "no-store" }),
      decode(fragmentPaymentSchema),
    );

  /** What the account's shared links brought, settled as it is read. */
  const shareTally = async (): Promise<ShareTally> =>
    readJson(await request("/shares", { method: "GET", cache: "no-store" }), decode(shareTallySchema));

  const createInvite = async (): Promise<OwnInvite> =>
    readJson(await request("/shares/invite", { method: "POST" }), decode(ownInviteSchema));

  const invitedFriends = async (): Promise<InvitedFriends> =>
    readJson(await request("/shares/friends", { method: "GET", cache: "no-store" }), decode(invitedFriendsSchema));

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
    deleteAccount,
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
    getOpeningProgress,
    addOpeningProgress,
    getOrderIntent,
    chooseOrder,
    getSealCode,
    redeemSealCode,
    createShare,
    sharePosted,
    uploadShareCard,
    openShare,
    joinedShare,
    shareTally,
    createInvite,
    invitedFriends,
    priceFragments,
    payFragments,
    fragmentPayment,
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
