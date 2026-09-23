import { resolveEndpoint } from "@realms-world/chain";
import {
  parseNotificationPreferences,
  type NotificationPreferences,
  type PushRegistration,
  type PushConfiguration,
} from "@bibliothecadao/notifications";
import type { SiwsTypedData } from "./siws";
import { buildSiwsMessage } from "./siws";
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

/** A refusal the identity service names, such as `account_not_secured` or `WALLET_LINKED_ELSEWHERE`. */
export class IdentityRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
  ) {
    super(code ?? `Identity request failed with status ${status}`);
  }
}

export interface IdentityClientOptions {
  /** The identity API root: `/api` when it is served under the page's own origin, or an absolute URL. */
  apiUrl: string;
  fetch?: typeof globalThis.fetch;
}

export interface SignInOptions {
  address: string;
  chainId: IdentityChainId;
  domain: string;
  uri: string;
  signTypedData: SignTypedData;
  statement?: string;
}

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
      code?: string;
    } | null;
    throw new IdentityRequestError(response.status, payload?.error ?? payload?.code ?? payload?.message);
  }
  return (await response.json()) as T;
};

const resolveApiUrl = (apiUrl: string): string =>
  apiUrl.startsWith("/")
    ? apiUrl.replace(/\/$/, "")
    : resolveEndpoint(apiUrl, { name: "identity API URL", browserFacing: true });

export const createIdentityClient = ({ apiUrl, fetch = globalThis.fetch }: IdentityClientOptions) => {
  const api = resolveApiUrl(apiUrl);
  const request = (path: string, init?: RequestInit) =>
    fetch(`${api}${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...init?.headers },
    });

  const getSession = async (): Promise<Session | null> => {
    const response = await request("/auth/get-session", { method: "GET" });
    return response.status === 401 ? null : await readJson<Session | null>(response);
  };

  /** Changes the chosen username or portrait; the server answers 422 with its reason when a name breaks a rule. */
  const updateUser = async (body: { name?: string; image?: string | null }): Promise<void> => {
    const response = await request("/auth/update-user", { method: "POST", body: JSON.stringify(body) });
    if (response.ok) return;
    const reason = await response
      .json()
      .then((payload: { message?: string; code?: string }) => payload.message ?? payload.code)
      .catch(() => undefined);
    throw new Error(reason ?? `Identity request failed with status ${response.status}`);
  };

  const signOut = async (): Promise<void> => {
    const response = await request("/auth/sign-out", { method: "POST", body: JSON.stringify({}) });
    if (!response.ok) {
      throw new Error(`Identity request failed with status ${response.status}`);
    }
  };

  const requireSession = async (): Promise<Session> => {
    const session = await getSession();
    if (!session) throw new Error("Identity session was not created");
    return session;
  };

  /** A Sign in with Starknet proof: the server's nonce in a SNIP-12 message the wallet signs. */
  const siwsProof = async (options: SignInOptions) => {
    const nonceResponse = await request("/auth/siws/nonce", {
      method: "POST",
      body: JSON.stringify({ address: options.address }),
    });
    const { nonce } = await readJson<{ nonce: string }>(nonceResponse);
    const message = buildSiwsMessage({ ...options, nonce });
    return {
      address: options.address,
      message: JSON.stringify(message),
      signature: await options.signTypedData(message),
    };
  };

  /**
   * Signs in with a wallet on a server that still offers it: only the DAO pages' own server (apps/web), until J5 moves
   * them. Players never sign in with a wallet; the identity Worker has no such route.
   */
  const signIn = async (options: SignInOptions): Promise<Session> => {
    await readJson(
      await request("/auth/siws/verify", { method: "POST", body: JSON.stringify(await siwsProof(options)) }),
    );
    return requireSession();
  };

  /** Links the wallet to the signed-in Realms account; the server refuses a wallet already linked elsewhere. */
  const linkWallet = async (options: SignInOptions): Promise<string> => {
    const linked = await readJson<{ address: string }>(
      await request("/auth/siws/link", { method: "POST", body: JSON.stringify(await siwsProof(options)) }),
    );
    return linked.address;
  };

  /** Emails a one-time sign-in code; the service limits how many an address and a client get a minute. */
  const sendSignInCode = async (email: string): Promise<void> => {
    await readJson(
      await request("/auth/email-otp/send-verification-otp", {
        method: "POST",
        body: JSON.stringify({ email, type: "sign-in" }),
      }),
    );
  };

  /** Signs in with an emailed code; an email's first sign-in creates its Realms account. */
  const signInWithCode = async (email: string, code: string): Promise<Session> => {
    await readJson(
      await request("/auth/sign-in/email-otp", { method: "POST", body: JSON.stringify({ email, otp: code }) }),
    );
    return requireSession();
  };

  /**
   * Where to send the player to sign in with Discord; Discord returns them to `returnTo`, signed in, or with an
   * `error` query parameter when sign-in did not complete.
   */
  const discordSignInUrl = async (returnTo: string): Promise<string> => {
    const started = await readJson<{ url: string }>(
      await request("/auth/sign-in/social", {
        method: "POST",
        body: JSON.stringify({ provider: "discord", callbackURL: returnTo, errorCallbackURL: returnTo }),
      }),
    );
    return started.url;
  };

  /**
   * Recovers a migrated account that has a linked wallet and no passkey: the wallet proves it once, and the short
   * session it gets is only for adding a passkey. The service never creates an account here.
   */
  const recoverWithWallet = async (options: SignInOptions): Promise<Session> => {
    await readJson(
      await request("/auth/siws/recover", { method: "POST", body: JSON.stringify(await siwsProof(options)) }),
    );
    return requireSession();
  };

  /** A new Realms account with no way back in yet; it must add a passkey before it can approve a device. */
  const signInAnonymously = async (): Promise<Session> => {
    await readJson(await request("/auth/sign-in/anonymous", { method: "POST", body: JSON.stringify({}) }));
    return requireSession();
  };

  /** Secures the signed-in account with a passkey on this device. */
  const registerPasskey = async (credentials: CredentialsContainer = navigator.credentials): Promise<void> => {
    const options = await readJson<PublicKeyCredentialCreationOptionsJSON>(
      await request("/auth/passkey/generate-register-options", { method: "GET" }),
    );
    const credential = (await credentials.create({
      publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
    })) as PublicKeyCredential | null;
    if (!credential) throw new Error("Passkey registration was cancelled");
    await readJson(
      await request("/auth/passkey/verify-registration", {
        method: "POST",
        body: JSON.stringify({ response: credential.toJSON() }),
      }),
    );
  };

  const signInWithPasskey = async (credentials: CredentialsContainer = navigator.credentials): Promise<Session> => {
    const options = await readJson<PublicKeyCredentialRequestOptionsJSON>(
      await request("/auth/passkey/generate-authenticate-options", { method: "GET" }),
    );
    const assertion = (await credentials.get({
      publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
    })) as PublicKeyCredential | null;
    if (!assertion) throw new Error("Passkey sign-in was cancelled");
    await readJson(
      await request("/auth/passkey/verify-authentication", {
        method: "POST",
        body: JSON.stringify({ response: assertion.toJSON() }),
      }),
    );
    return requireSession();
  };

  /** The guardian's `[r, s]` over one device change on the signed-in player's own account. */
  const approveDeviceChange = async (change: DeviceChangeRequest): Promise<string[]> => {
    const approved = await readJson<{ signature: string[] }>(
      await request("/devices", { method: "POST", body: JSON.stringify(change) }),
    );
    return approved.signature;
  };

  const getNotificationPreferences = async (): Promise<NotificationPreferences> =>
    parseNotificationPreferences(
      await readJson(await request("/notifications/preferences", { method: "GET", cache: "no-store" })),
    );
  const saveNotificationPreferences = async (
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences> => {
    const response = await request("/notifications/preferences", {
      method: "POST",
      body: JSON.stringify(preferences),
    });
    if (response.status === 409)
      throw new Error("Preferences changed on another device. Reload them before saving again.");
    if (response.status === 403 || response.status === 401)
      throw new Error("Your account changed or signed out. Reload your preferences.");
    return parseNotificationPreferences(await readJson(response));
  };

  const pushRequest = async <T>(action: string, body?: unknown, options: { keepalive?: boolean } = {}): Promise<T> =>
    readJson<T>(
      await request(`/notifications/push/${action}`, {
        ...(body === undefined
          ? { method: "GET", cache: "no-store" as const }
          : { method: "POST", body: JSON.stringify(body) }),
        keepalive: options.keepalive,
        signal: AbortSignal.timeout(10_000),
      }),
    );
  return {
    getSession,
    signIn,
    signInAnonymously,
    registerPasskey,
    signInWithPasskey,
    linkWallet,
    recoverWithWallet,
    sendSignInCode,
    signInWithCode,
    discordSignInUrl,
    approveDeviceChange,
    signOut,
    updateUser,
    getNotificationPreferences,
    saveNotificationPreferences,
    getPushConfiguration: () => pushRequest<PushConfiguration>("config"),
    registerPushSubscription: (input: PushRegistration) => pushRequest<{ id: string }>("subscribe", input),
    getPushSubscriptionStatus: (owner: string, id: string) =>
      pushRequest<{ registered: boolean; gameAlerts: boolean; directMessages: boolean }>("status", {
        owner,
        id,
      }),
    setPushGameForeground: (owner: string, id: string, foreground: boolean) =>
      pushRequest<{ foreground: boolean }>("foreground", { owner, id, foreground }, { keepalive: true }),
    revokePushSubscription: (id: string, token: string) => pushRequest<{ revoked: boolean }>("revoke", { id, token }),
  };
};
