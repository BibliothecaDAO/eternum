import { isLoopbackOrigin, resolveEndpoint } from "@realms-world/chain";
import type { SiwsTypedData } from "./siws";
import { buildSiwsMessage } from "./siws";
import type { IdentityChainId, Session } from "./types";

export type SignTypedData = (message: SiwsTypedData) => Promise<string[]>;

export interface IdentityClientOptions {
  baseUrl: string;
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

export const createIdentityClient = ({ baseUrl, fetch = globalThis.fetch }: IdentityClientOptions) => {
  const authBaseUrl = resolveEndpoint(baseUrl, { name: "identity base URL", browserFacing: true });
  const storage =
    typeof window !== "undefined" && isLoopbackOrigin(window.location.origin) ? window.localStorage : null;
  const tokenKey = `identity-session:${authBaseUrl}`;
  const request = (path: string, init?: RequestInit) => {
    const token = storage?.getItem(tokenKey);
    return fetch(`${authBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  };

  const getSession = async (): Promise<Session | null> => {
    const response = await request("/get-session", { method: "GET" });
    const session = response.status === 401 ? null : await readJson<Session | null>(response);
    if (!session) storage?.removeItem(tokenKey);
    return session;
  };

  /** Changes the chosen username or portrait; the server answers 422 with its reason when a name breaks a rule. */
  const updateUser = async (body: { name?: string; image?: string | null }): Promise<void> => {
    const response = await request("/update-user", { method: "POST", body: JSON.stringify(body) });
    if (response.ok) return;
    const reason = await response
      .json()
      .then((payload: { message?: string; code?: string }) => payload.message ?? payload.code)
      .catch(() => undefined);
    throw new Error(reason ?? `Identity request failed with status ${response.status}`);
  };

  const signOut = async (): Promise<void> => {
    const response = await request("/sign-out", { method: "POST", body: JSON.stringify({}) });
    if (!response.ok) {
      throw new Error(`Identity request failed with status ${response.status}`);
    }
    storage?.removeItem(tokenKey);
  };

  const signIn = async (options: SignInOptions): Promise<Session> => {
    const nonceResponse = await request("/siws/nonce", {
      method: "POST",
      body: JSON.stringify({ address: options.address }),
    });
    const { nonce } = await readJson<{ nonce: string }>(nonceResponse);
    const message = buildSiwsMessage({ ...options, nonce });
    const signature = await options.signTypedData(message);

    const { token } = await readJson<{ token: string }>(
      await request("/siws/verify", {
        method: "POST",
        body: JSON.stringify({
          address: options.address,
          message: JSON.stringify(message),
          signature,
        }),
      }),
    );

    storage?.setItem(tokenKey, token);
    const session = await getSession();
    if (!session) throw new Error("Identity session was not created");
    return session;
  };

  return { getSession, signIn, signOut, updateUser };
};
