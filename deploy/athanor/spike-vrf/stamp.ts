import { isGamesInvoke, type Invoke } from "./transaction";

export interface RpcCall {
  jsonrpc: string;
  id?: unknown;
  method: string;
  params: any;
}
export interface Stamp {
  games: string;
  chain: string;
  accountClass: string;
  stamp(tx: Invoke, chain: string): Promise<Invoke>;
}

export function gamesTransaction(call: RpcCall, stamp: Stamp): Invoke | undefined {
  if (call.method !== "starknet_addInvokeTransaction") return undefined;
  const transaction = Array.isArray(call.params) ? call.params[0] : call.params?.invoke_transaction;
  return isGamesInvoke(transaction, stamp.games) ? transaction : undefined;
}

export async function stampRequest(call: RpcCall, stamp: Stamp): Promise<RpcCall> {
  const tx = gamesTransaction(call, stamp);
  if (!tx) return call;
  const forwarded = await stamp.stamp(tx, stamp.chain);
  return {
    ...call,
    params: Array.isArray(call.params)
      ? [forwarded, ...call.params.slice(1)]
      : { ...call.params, invoke_transaction: forwarded },
  };
}
