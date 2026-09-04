import { resolveEndpoint } from "@realms-world/chain";
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
  const request = (path: string, init?: RequestInit) =>
    fetch(`${authBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...init?.headers,
      },
    });

  const getSession = async (): Promise<Session | null> => {
    const response = await request("/get-session", { method: "GET" });
    if (response.status === 401) return null;
    return readJson<Session | null>(response);
  };

  const signOut = async (): Promise<void> => {
    const response = await request("/sign-out", { method: "POST", body: JSON.stringify({}) });
    if (!response.ok) {
      throw new Error(`Identity request failed with status ${response.status}`);
    }
  };

  const signIn = async (options: SignInOptions): Promise<Session> => {
    const nonceResponse = await request("/siws/nonce", {
      method: "POST",
      body: JSON.stringify({ address: options.address }),
    });
    const { nonce } = await readJson<{ nonce: string }>(nonceResponse);
    const message = buildSiwsMessage({ ...options, nonce });
    const signature = await options.signTypedData(message);

    await readJson<{ token: string }>(
      await request("/siws/verify", {
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

  return { getSession, signIn, signOut };
};
