import { encodeChainName, environmentL2, type PaymentReceipt } from "@realms-world/chain";
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

/** The latest block's L2 gas price, in fri: what prices a default wallet's signature check (paymaster.ts). */
export const latestL2GasPrice = async (provider: RpcProvider) => (await provider.getGasPrices("latest")).l2GasPrice;

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

const TRANSACTION_NOT_FOUND = 29;

export const readPaymentReceipt = async (env: L2Environment, transactionHash: string) => {
  const receipt = await l2Call<PaymentReceipt & { block_number?: number }>(env, "starknet_getTransactionReceipt", {
    transaction_hash: transactionHash,
  });
  if (!receipt || receipt.block_number === undefined) return null;
  const block = await l2Call<{ timestamp: number }>(env, "starknet_getBlockWithTxHashes", {
    block_id: { block_number: receipt.block_number },
  });
  if (!block) throw new Error("identity_l2_block_missing");
  return { receipt, timestamp: block.timestamp };
};

const l2Call = async <T>(env: L2Environment, method: string, params: Record<string, unknown>): Promise<T | null> => {
  const response = await fetchIdentityRpc(identityL2Configuration(env).rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`identity_l2_${response.status}`);
  const body = (await response.json()) as { result?: T; error?: { code?: number } };
  if (body.error?.code === TRANSACTION_NOT_FOUND) return null;
  if (body.result === undefined) throw new Error(`identity_l2_error_${body.error?.code ?? "unknown"}`);
  return body.result;
};
