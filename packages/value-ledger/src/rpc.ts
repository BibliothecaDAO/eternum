import { RpcProvider, shortString } from "starknet";

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

/** RPC nodes return Cairo contract refusals as text or a felt in a serialized ByteArray. */
export function isContractRevert(error: unknown, reason: string): boolean {
  if (!error || typeof error !== "object") return false;
  const rpc = error as { code?: number; baseError?: unknown; cause?: unknown };
  if (rpc.code !== 40) return isContractRevert(rpc.baseError, reason) || isContractRevert(rpc.cause, reason);
  const detail = JSON.stringify(error);
  if (detail.includes(reason)) return true;
  const felts: string[] = detail.match(/0x[0-9a-f]+/gi) ?? [];
  return reason.length <= 31 && felts.includes(shortString.encodeShortString(reason));
}
