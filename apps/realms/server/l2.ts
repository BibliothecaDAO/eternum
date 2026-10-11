import { encodeChainName, environmentL2, valuePlaneAddress } from "@realms-world/chain";
import { RpcProvider } from "starknet";

interface L2Environment {
  ENVIRONMENT: import("@realms-world/chain").ValueEnvironment;
  IDENTITY_RPC_URL: string;
}

/** One explicit environment chain and its paid RPC replace inferred/mainnet-only reads. */
export const identityL2Configuration = (env: L2Environment) => {
  const { chain } = environmentL2(env.ENVIRONMENT);
  let url: URL;
  try {
    url = new URL(env.IDENTITY_RPC_URL);
  } catch {
    throw new Error("IDENTITY_RPC_URL requires the environment's HTTPS Alchemy endpoint");
  }
  if (!isMainnetAlchemy(url)) throw new Error("IDENTITY_RPC_URL requires the environment's HTTPS Alchemy endpoint");
  return { chainId: chain, rpcUrl: env.IDENTITY_RPC_URL };
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

/** Labor ownership uses the same chain/RPC as wallet proof and ratings; the relay has no second Realms reader. */
export const realmOwnerOf = async (env: L2Environment, realmId: string) => {
  const id = BigInt(realmId);
  if (id < 0n || id >= 2n ** 256n) throw new Error("invalid_realm_id");
  const provider = identityProvider(env);
  await verifyIdentityChain(provider, env);
  const owner = await provider.callContract(
    {
      contractAddress: valuePlaneAddress("realms", env.ENVIRONMENT),
      entrypoint: "owner_of",
      calldata: [String(id & (2n ** 128n - 1n)), String(id >> 128n)],
    },
    "latest",
  );
  if (owner.length !== 1 || BigInt(owner[0]!) <= 0n || BigInt(owner[0]!) >= (1n << 251n) - 256n)
    throw new Error("invalid_realm_owner");
  return owner[0]!;
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
