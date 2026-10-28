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

export const identityProvider = (env: L2Environment) =>
  new RpcProvider({
    nodeUrl: identityL2Configuration(env).rpcUrl,
    blockIdentifier: "latest",
    baseFetch: fetchIdentityRpc,
  });

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
