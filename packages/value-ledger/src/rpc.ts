import { RpcProvider } from "starknet";

/** Missing configuration must never select the library's default public RPC. */
export const rpcAt = (rpcUrl: string): RpcProvider => {
  try {
    const url = new URL(rpcUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error("RPC URL is missing or invalid");
  }
  return new RpcProvider({ nodeUrl: rpcUrl });
};
