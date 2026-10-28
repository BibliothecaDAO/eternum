import { encodeChainName, environmentL2 } from "@realms-world/chain";
import { RpcProvider } from "starknet";

interface L2Environment {
  ENVIRONMENT: import("@realms-world/chain").ValueEnvironment;
  L2_RPC_URL: string;
}

/** One explicit environment chain and its paid RPC replace inferred/mainnet-only reads. */
export const identityL2Configuration = (env: L2Environment) => {
  const { chain } = environmentL2(env.ENVIRONMENT);
  let url: URL;
  try {
    url = new URL(env.L2_RPC_URL);
  } catch {
    throw new Error("L2_RPC_URL requires the environment's HTTPS Alchemy endpoint");
  }
  if (!isMainnetAlchemy(url)) throw new Error("L2_RPC_URL requires the environment's HTTPS Alchemy endpoint");
  return { chainId: chain, rpcUrl: env.L2_RPC_URL };
};

/** Point reads share the marketplace's RPC relay (one provider with the marketplace); `L2_RPC_URL` answers when it cannot. */
interface PointReadEnvironment extends L2Environment {
  /** The marketplace API's base, up to (not including) `/v1`; its relay is `/rpc`. */
  MARKETPLACE_API_URL: string;
}

const RELAY_TIMEOUT_MS = 3_000;

export const identityProvider = (env: PointReadEnvironment) =>
  new RpcProvider({
    nodeUrl: identityL2Configuration(env).rpcUrl,
    blockIdentifier: "latest",
    baseFetch: (input: RequestInfo | URL, init?: RequestInit) => fetchPointRead(env, input, init),
  });

/** The relay's response when it carries the chain's answer (a result or a Starknet error such as a revert), else `L2_RPC_URL`'s. */
const fetchPointRead = async (env: PointReadEnvironment, input: RequestInfo | URL, init?: RequestInit) => {
  const relayed = await fetchIdentityRpc(`${env.MARKETPLACE_API_URL}/rpc`, {
    ...init,
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
  })
    .then(async (response) => (response.ok && answersForChain(await response.clone().json()) ? response : null))
    .catch(() => null);
  return relayed ?? fetchIdentityRpc(input, init);
};

/** Starknet errors have positive codes; JSON-RPC's own negative codes (unsupported method, relay failure) do not answer. */
const answersForChain = (body: unknown) => {
  const { result, error } = (body ?? {}) as { result?: unknown; error?: { code?: unknown } };
  return result !== undefined || (typeof error?.code === "number" && error.code > 0);
};

export const verifyIdentityChain = async (provider: RpcProvider, env: L2Environment) => {
  const { chainId } = identityL2Configuration(env);
  if (BigInt(await provider.getChainId()) !== BigInt(encodeChainName(chainId)))
    throw new Error("identity_l2_chain_mismatch");
};

const isMainnetAlchemy = (url: URL) => {
  return (
    url.protocol === "https:" &&
    url.hostname === "starknet-mainnet.g.alchemy.com" &&
    !url.port &&
    !url.username &&
    !url.password &&
    !url.hash &&
    url.pathname !== "/"
  );
};

/** Workers implement manual redirects; refuse them before another host can receive an RPC request. */
export const fetchIdentityRpc = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await fetch(input, { ...init, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) throw new Error("identity_l2_redirect_refused");
  return response;
};
