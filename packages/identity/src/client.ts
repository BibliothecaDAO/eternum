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
    throw new Error(`Identity request failed with status ${response.status}`);
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

  const signIn = async (options: SignInOptions): Promise<Session> => {
    const nonceResponse = await request("/auth/siws/nonce", {
      method: "POST",
      body: JSON.stringify({ address: options.address }),
    });
    const { nonce } = await readJson<{ nonce: string }>(nonceResponse);
    const message = buildSiwsMessage({ ...options, nonce });
    const signature = await options.signTypedData(message);

    await readJson(
      await request("/auth/siws/verify", {
        method: "POST",
        body: JSON.stringify({
          address: options.address,
          message: JSON.stringify(message),
          signature,
        }),
      }),
    );

    const session = await getSession();
    if (!session) throw new Error("Identity session was not created");
    return session;
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
